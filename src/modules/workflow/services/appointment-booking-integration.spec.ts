import { ConsoleLogger, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import axios from 'axios';
import { ConversationService } from 'src/modules/conversation/services/conversation.service';
import { ChannelSenderFactory } from 'src/channels/senders/channel-sender-factory';
import { seedWorkflows } from 'src/scripts/seed-workflows';
import { seedQuestionnaires } from 'src/scripts/seed-questionnaires';
import { ProcessAnswerStatus } from 'src/modules/questionnaire/processors/question-processor.service';
import { seedChannels } from 'src/scripts/seed-channels';
import { ConversationModule } from 'src/modules/conversation/conversation.module';
import { ChannelsModule } from 'src/channels/channels.module';
import { WorkflowEngineModule } from '../workflow-engine.module';

jest.mock('axios');

jest.setTimeout(30000); // 30 seconds
describe('Appointment Booking Integration (Questionnaire + Workflow)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let conversationService: ConversationService;
  const facilityId = '60203e1c1ec8a00015baa357';

  process.env.MONGOMS_DOWNLOAD_DIR = './mongo-binaries';

  // Mock Channel Sender to capture messages sent to "user"
  const mockSender = {
    sendMessage: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      binary: { version: '6.0.6' },
      instance: { ip: '127.0.0.1' },
    });
    const uri = mongoServer.getUri();
    process.env.DATABASE_URI = uri; // 🔥 THIS is key


    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        //AppModule,
        ConversationModule,
        ChannelsModule,
        WorkflowEngineModule,
      ],
    })
      .overrideProvider(ChannelSenderFactory)
      .useValue({
        getSender: jest.fn().mockResolvedValue(mockSender),
      })
      .setLogger(new ConsoleLogger())
      .compile();

    app = moduleRef.createNestApplication();
    conversationService = moduleRef.get<ConversationService>(ConversationService);

    // Seed the definitions
    const nestApp = { get: (token: any) => moduleRef.get(token) } as any;
    await seedWorkflows(nestApp);
    await seedQuestionnaires(nestApp);
    await seedChannels(nestApp);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HS_BACKEND_BASE_URL = 'https://example.test';
    process.env.HS_BACKEND_USERNAME = 'test@example.com';
    process.env.HS_BACKEND_PASSWORD = 'secret';

    (axios.request as jest.Mock).mockImplementation(async (config: any) => {
      if (config.url === 'https://example.test/authentication') {
        return {
          data: { accessToken: 'token-123' },
          status: 201,
          headers: {},
        };
      }

      if (config.url === 'https://example.test/facility') {
        return {
          data: {
            total: 1,
            data: [
              {
                _id: facilityId,
                facilityName: 'General Hospital Central',
              },
            ],
          },
          status: 200,
          headers: {},
        };
      }

      throw new Error(`Unexpected axios.request call: ${config.url}`);
    });
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
    await mongoServer.stop();
  });

  it('should progress through the appointment booking flow and trigger workflow actions', async () => {
    const participantId = '680000000000000000000001';
    const channel = { id: '680000000000000000000101', type: 'WHATSAPP' } as any;
    const questionnaireCode = 'WF_APPOINTMENT_Q';

    // 1. Initial Message: Start the conversation
    // This should create a conversation and send the first question (Appointment Type)
    const initResult = await conversationService.processInboundMessage(
      channel,
      participantId,
      participantId,
      'Start',
      questionnaireCode,
      { messageId: 'msg-1' } as any,
    );

    expect(initResult.responded).toBe(true);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'appointment_type',
      expect.stringContaining('Select appointment type'),
      expect.anything(),
    );

    // 2. User selects Appointment Type: "New"
    // Next question in questionnaire is "facilityId" (text input)
    const typeResult = await conversationService.processInboundMessage(
      channel,
      participantId,
      participantId,
      'New',
      questionnaireCode,
      { messageId: 'msg-2' } as any,
    );

    expect(typeResult.reason).toBe(ProcessAnswerStatus.NEXT_QUESTION);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'facilityId',
      expect.stringContaining('Enter facility name'),
      expect.anything(),
    );

    // 3. User enters facility name: "General Hospital"
    // This triggers WORKFLOW_PROCESSED mode. 
    // The Workflow Engine should catch ANSWER_RECEIVED.
    // Transition: authenticate -> fetch_facilities -> emit_facility_options

    const facilityInputResult = await conversationService.processInboundMessage(
      channel,
      participantId,
      participantId,
      'General Hospital',
      questionnaireCode,
      { messageId: 'msg-3' } as any,
    );

    // Since actions are asynchronous/event-driven, we verify the immediate response is "PROCESSING_WORKFLOW_ANSWER"
    expect(facilityInputResult.action).toBe('PROCESSING_WORKFLOW_ANSWER');

    // Verify the user receives the workflow-generated options prompt
    await waitFor(() => {
      expect(
        mockSender.sendMessage.mock.calls.some(
          ([, , attribute, outboundMessage]) =>
            attribute === 'facilityId_options' &&
            typeof outboundMessage === 'string' &&
            outboundMessage.includes('Select a facility'),
        ),
      ).toBe(true);
    });
  });
});

async function waitFor(assertion: () => Promise<void> | void, timeoutMs = 3000) {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  throw lastError;
}
