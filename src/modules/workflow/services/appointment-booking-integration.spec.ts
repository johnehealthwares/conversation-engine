import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ConversationService } from 'src/modules/conversation/services/conversation.service';
import { StepRunnerService } from './step-runner.service';
import { ChannelSenderFactory } from 'src/channels/senders/channel-sender-factory';
import { AppModule } from 'src/app.module';
import { seedWorkflows } from 'src/scripts/seed-workflows';
import { seedQuestionnaires } from 'src/scripts/seed-questionnaires';
import { ProcessAnswerStatus } from 'src/modules/questionnaire/processors/question-processor.service';
import { seedChannels } from 'src/scripts/seed-channels';
import { ConversationModule } from 'src/modules/conversation/conversation.module';
import { ChannelsModule } from 'src/channels/channels.module';
import { WorkflowEngineModule } from '../workflow-engine.module';
import { ConsoleLogger } from '@nestjs/common';

jest.setTimeout(30000); // 30 seconds
describe('Appointment Booking Integration (Questionnaire + Workflow)', () => {
  let app: TestingModule;
  let mongoServer: MongoMemoryServer;
  let conversationService: ConversationService;
  let stepRunnerService: StepRunnerService;
  let senderFactory: ChannelSenderFactory;
  process.env.MONGOMS_DOWNLOAD_DIR = './mongo-binaries'
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


    app = await Test.createTestingModule({
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

    conversationService = app.get<ConversationService>(ConversationService);
    stepRunnerService = app.get<StepRunnerService>(StepRunnerService);
    senderFactory = app.get<ChannelSenderFactory>(ChannelSenderFactory);

    // Seed the definitions
    const nestApp = { get: (token: any) => app.get(token) } as any;
    await seedWorkflows(nestApp);
    await seedQuestionnaires(nestApp);
    await seedChannels(nestApp);
  });

  afterAll(async () => {
    await app.close();
    await mongoServer.stop();
  });

  it.skip('should progress through the appointment booking flow and trigger workflow actions', async () => {
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
    // The Workflow Engine should catch WORKFLOW_ANSWER_RECEIVED.
    // Transition: authenticate -> fetch_facilities -> emit_facility_options

    // Spy on StepRunner to ensure actions are executed
    const executeSpy = jest.spyOn(stepRunnerService as any, 'executeAction');

    // Mocking the handler response for HTTP calls within StepRunner
    // In a real integration test, you might use 'nock' to mock the HS_BACKEND_BASE_URL
    jest.spyOn(stepRunnerService as any, 'getHandler').mockReturnValue(async (config: any) => {
      if (config.url.includes('authentication')) {
        return { success: true, data: { accessToken: 'fake-token' } };
      }
      if (config.url.includes('facility')) {
        return {
          success: true,
          data: [
            { _id: 'fac-1', facilityName: 'General Hospital Central', index: '1' },
            { _id: 'fac-2', facilityName: 'General Hospital North', index: '2' }
          ],
          total: 2
        };
      }
      return { success: true, data: {} };
    });

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

    // Wait for event loop to process workflow transitions
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify the workflow executed the correct steps
    expect(executeSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'authenticate' }), expect.anything());
    expect(executeSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'fetch_facilities' }), expect.anything());
    expect(executeSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'emit_facility_options' }), expect.anything());

    // Verify the final message sent to the user contains the resolved options
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('facilityId_options'),
      expect.stringContaining('Select a facility'),
      expect.anything(),
    );
  });
});