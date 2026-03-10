jest.setTimeout(1000000);
process.env.MONGOMS_BINARY_VERSION = '6.0.6';
process.env.MONGOMS_DOWNLOAD_DIR = './mongo-binaries';
process.env.MONGOMS_IP = '127.0.0.1';

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ConversationModule } from './modules/conversation/conversation.module';
import { ConversationService } from './modules/conversation/services/conversation.service';
import { Conversation } from './modules/conversation/schemas/conversation.schema';
import { Participant } from './modules/conversation/schemas/participant.schema';
import { Questionnaire } from './modules/conversation/schemas/questionnaire.schema';
import { Response } from './modules/conversation/schemas/response.schema';
import { Channel, ChannelType } from './modules/conversation/schemas/channel.schema';
import {
  OptionDomain,
  ProcessMode,
  ProcessingStrategy,
  QuestionType,
  QuestionnaireDomain,
  RenderMode,
} from './shared/domain';
import { NigeriaBulkSmsSender } from './channels/senders/sms-sender';
import { WhatsappSender } from './channels/senders/whatsapp-sender';
import { BadRequestException } from '@nestjs/common';
import { toDomain } from './shared/converters';
import { todo } from 'node:test';
import net from 'node:net';

type SentMessage = {
  phone: string;
  message: string;
};

type TestScenario = {
  name: string;
  mode: 'TEXT' | 'OPTION' | 'AI' | 'MIXED' | 'BRANCHING';
  includeRequiredError?: boolean;
  includeInvalidOptionError?: boolean;
};

const getFreeLocalPort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Failed to resolve local port'));
          return;
        }
        resolve(address.port);
      });
    });
  });

describe('ConversationService Integration', () => {
  let mongoServer: MongoMemoryServer;
  let moduleFixture: TestingModule;
  let conversationService: ConversationService;

  let questionnaireModel: Model<Questionnaire>;
  let participantModel: Model<Participant>;
  let conversationModel: Model<Conversation>;
  let responseModel: Model<Response>;
  let channelModel: Model<Channel>;

  const sentMessages: SentMessage[] = [];

  const scenarios: TestScenario[] = [
    { name: 'simple_text_linear', mode: 'TEXT' },
    { name: 'text_required_validation', mode: 'TEXT', includeRequiredError: true },
    { name: 'option_linear_valid', mode: 'OPTION' },
    {
      name: 'option_validation_then_valid',
      mode: 'OPTION',
      includeInvalidOptionError: true,
    },
    { name: 'ai_linear', mode: 'AI' },
    { name: 'mixed_text_option_ai', mode: 'MIXED' },
    { name: 'branching_option_jump', mode: 'BRANCHING' },
    {
      name: 'mixed_with_required_error',
      mode: 'MIXED',
      includeRequiredError: true,
    },
    {
      name: 'mixed_with_option_error',
      mode: 'MIXED',
      includeInvalidOptionError: true,
    },
    {
      name: 'complex_mixed_errors',
      mode: 'MIXED',
      includeRequiredError: true,
      includeInvalidOptionError: true,
    },
  ];

  beforeAll(async () => {
    console.log('[TRACE] Starting MongoMemoryServer...');
    const port = await getFreeLocalPort();
    mongoServer = await MongoMemoryServer.create({
      binary: { version: '6.0.6' },
      instance: { ip: '127.0.0.1', port },
    });
    const mongoUri = mongoServer.getUri();
    console.log('[TRACE] MongoMemoryServer running at', mongoUri);


    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongoUri, {
          dbName: 'conversation_service_integration_test',
        }),
        ConversationModule,
      ],
    })
      .overrideProvider(NigeriaBulkSmsSender)
      .useValue({
        sendMessage: async (participant: any, message: string) => {
          sentMessages.push({ phone: participant.phone, message });          
          console.log(`[TRACE] SMS sent to ${participant.phone}: "${message}"`);
        },
      })
      .overrideProvider(WhatsappSender)
      .useValue({
        sendMessage: async (participant: any, message: string) => {
          sentMessages.push({ phone: participant.phone, message });
          console.log(`[TRACE] WhatsApp sent to ${participant.phone}: "${message}"`);
        },
      })
      .compile();

    conversationService = moduleFixture.get(ConversationService);
    questionnaireModel = moduleFixture.get(getModelToken(Questionnaire.name));
    participantModel = moduleFixture.get(getModelToken(Participant.name));
    conversationModel = moduleFixture.get(getModelToken(Conversation.name));
    responseModel = moduleFixture.get(getModelToken(Response.name));
    channelModel = moduleFixture.get(getModelToken(Channel.name));
  });

  afterEach(() => {
    sentMessages.length = 0;
  });

  afterAll(async () => {
    //console.log('[TRACE] Closing testing module and MongoMemoryServer...');
    if (moduleFixture) {
      await moduleFixture.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

it('runs 10 questionnaires (5 questions each) from simple to complex scenarios', async () => {
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      console.log(`\n[TRACE] === Running scenario ${i + 1}/${scenarios.length}: ${scenario.name} ===`);

      const participantSchema = await participantModel.create({
        firstName: `User${i + 1}`,
        lastName: 'Integration',
        email: `conversation-service-${i + 1}@test.dev`,
        phone: `+2348100000${String(i + 1).padStart(3, '0')}`,
      });
      const participant = toDomain(participantSchema);
      console.log(`[TRACE] Created participant ${participant.phone}`);

      const schema = await channelModel.create({ name: `SMS-${i + 1}`, type: ChannelType.SMS });
      const channel = toDomain(schema);
      console.log(`[TRACE] Created channel ${channel.name} (${channel.type})`);

      const questionnaire = await seedQuestionnaireWithFiveQuestions(questionnaireModel, scenario);
      console.log(`[TRACE] Seeded questionnaire "${questionnaire.name}" with code ${questionnaire.code}`);

      console.log(`[TRACE] Sending first inbound message to start conversation...`);
      await conversationService.processInboundMessageFromPhoneNumber(channel, participant.phone, "Hello", questionnaire.code, {messageId: ''});

      let conversation = await conversationService.findActiveConversationOfParticipant(participant.id);
      console.log(`[TRACE] Conversation created with status: ${conversation?.status}, state: ${conversation?.state}`);
      expect(conversation).toBeTruthy();
      expect(conversation?.status).toBe('ACTIVE');
      expect(conversation?.state).toBe('PROGRESS');
      expect(sentMessages.length).toBe(1);

      const questionIds = questionnaire.questions!.map((q: any) => q.id.toString());
      const answers = buildAnswerScript(questionnaire.questions!, scenario);

      let expectedInboundCount = 0;
      let expectedOutboundCount = 1;

      for (const answer of answers) {
        console.log(`[TRACE] Processing inbound answer: "${answer.value}"`);
        await conversationService.processInboundMessageFromPhoneNumber(channel, participant.phone, answer.value, questionnaire.code, {messageId: ''});

         expectedOutboundCount += 1; // always one outbound per inbound
      }
      console.log(conversation)
      conversation = toDomain(await conversationModel.findById(new Types.ObjectId(conversation!.id)).lean());
      const responses = await responseModel.find({ conversationId: conversation!.id }).lean();
      console.log(`[TRACE] Total responses collected: ${responses.length}`);

      const inboundResponses = responses.filter(r => r.direction === 'INBOUND');
      const outboundResponses = responses.filter(r => r.direction === 'OUTBOUND');

      if (conversation?.status !== 'COMPLETED') {
        console.error(`[TRACE] Scenario ${scenario.name} did not complete properly`);
        console.error(`[TRACE] Status=${conversation?.status}, State=${conversation?.state}, CurrentQuestion=${conversation?.currentQuestionId}`);
      }

      expect(conversation?.status).toBe('COMPLETED');
      expect(conversation?.state).toBe('COMPLETED');
      expect(conversation?.endedAt).toBeDefined();
      expect(inboundResponses.length).toBe(expectedInboundCount);
      expect(outboundResponses.length).toBe(expectedOutboundCount);

      console.log(`[TRACE] Scenario ${scenario.name} completed successfully`);
      sentMessages.length = 0;
    }
  });

//   it('rejects new inbound messages after completion', async () => {
//     const participant = await participantModel.create({
//       firstName: 'Completed',
//       lastName: 'Case',
//       email: 'conversation-service-completed@test.dev',
//       phone: '+2348100000999',
//     });

//     const schema = await channelModel.create({
//       name: 'SMS-COMPLETED',
//       type: ChannelType.SMS,
//     });
//     const channel = toDomain(schema);

//     const scenario: TestScenario = {
//       name: 'completed_rejection',
//       mode: 'TEXT',
//     };
//     const questionnaire = await seedQuestionnaireWithFiveQuestions(
//       questionnaireModel,
//       scenario,
//     );

//     await conversationService.processInboundMessage(channel,participant,'start',questionnaire.code);

//     let conversation = await conversationModel
//       .findOne({
//         $or: [
//           { participantId: participant._id },
//           { participantId: participant._id.toString() },
//         ],
//       })
//       .sort({ createdAt: -1 })
//       .lean();

//     const answers = buildAnswerScript(questionnaire.questions!, scenario);
//     for (const answer of answers) {
//       await conversationService.processInboundMessage(channel, participant, answer.value,questionnaire.code);
//     }

//     conversation = await conversationModel.findById(new Types.ObjectId(conversation!._id)).lean();
//     expect(conversation?.status).toBe('COMPLETED');
//     await
//     await expect(
//       conversationService.processInboundMessage(channel, participant, 'onne more answer',questionnaire.code)
//     ).rejects.toBeInstanceOf(BadRequestException);
//   });
});

function buildAnswerScript(questions: any[], scenario: TestScenario) {
  const validByQuestion = questions.map((question, idx) => {
    const textAnswer = `answer-${idx + 1}`;

    if (question.processMode === ProcessMode.OPTION_PROCESSED) {
      return question.options?.[0]?.key || 'opt_0';
    }
    if (question.processMode === ProcessMode.AI_PROCESSED) {
      return `ai-answer-${idx + 1}`;
    }
    return textAnswer;
  });

  const script: Array<{ value: string; expectsValidationError?: boolean }> = [];

  if (scenario.includeRequiredError) {
    script.push({ value: '', expectsValidationError: true });
  }

  script.push({ value: validByQuestion[0] });

  if (scenario.includeInvalidOptionError) {
    const optionQuestion = questions.find(
      (question) => question.processMode === ProcessMode.OPTION_PROCESSED,
    );
    if (optionQuestion) {
      script.push({ value: 'INVALID_OPTION', expectsValidationError: true });
    }
  }

  if (scenario.mode === 'BRANCHING') {
    // Q2 jumps directly to Q4, so answers are Q1, Q2, Q4, Q5
    script.push({ value: validByQuestion[1] });
    script.push({ value: validByQuestion[3] });
    script.push({ value: validByQuestion[4] });
    return script;
  }

  script.push({ value: validByQuestion[1] });
  script.push({ value: validByQuestion[2] });
  script.push({ value: validByQuestion[3] });
  script.push({ value: validByQuestion[4] });
  return script;
}

async function seedQuestionnaireWithFiveQuestions(
  questionnaireModel: Model<Questionnaire>,
  scenario: TestScenario,
): Promise<QuestionnaireDomain> {
  const questionnaireId = new Types.ObjectId();
  const questionIds = Array.from({ length: 5 }, () => new Types.ObjectId());

  const baseQuestions = questionIds.map((id, index) => ({
    _id: id,
    questionnaireId,
    text: `${scenario.name} question ${index + 1}`,
    index,
    tags: ['integration-test'],
    questionType: QuestionType.TEXT,
    renderMode: RenderMode.INPUT,
    processMode: ProcessMode.NONE,
    isRequired: index === 0,
    isActive: true,
    options: [] as OptionDomain[],
  }));

  if (scenario.mode === 'OPTION') {
    for (const question of baseQuestions) {
      question.questionType = QuestionType.SINGLE_CHOICE;
      question.renderMode = RenderMode.RADIO;
      question.processMode = ProcessMode.OPTION_PROCESSED;
      question.options = [
        {
          id: new Types.ObjectId().toString(),
          key: 'a',
          label: 'Option A',
          value: 'a',
          index: 0,
        },
        {
          id: new Types.ObjectId().toString(),
          key: 'b',
          label: 'Option B',
          value: 'b',
          index: 1,
        },
      ] as OptionDomain[];
    }
  }

  if (scenario.mode === 'AI') {
    baseQuestions[2].questionType = QuestionType.AI_OPEN;
    baseQuestions[2].renderMode = RenderMode.CHAT;
    baseQuestions[2].processMode = ProcessMode.AI_PROCESSED;
  }

  if (scenario.mode === 'MIXED') {
    baseQuestions[1].questionType = QuestionType.SINGLE_CHOICE;
    baseQuestions[1].renderMode = RenderMode.RADIO;
    baseQuestions[1].processMode = ProcessMode.OPTION_PROCESSED;
    baseQuestions[1].options = [
      {
        key: 'yes',
        label: 'Yes',
        value: 'yes',
        index: 0,
      },
      {
        key: 'no',
        label: 'No',
        value: 'no',
        index: 1,
      },
    ];

    baseQuestions[3].questionType = QuestionType.AI_OPEN;
    baseQuestions[3].renderMode = RenderMode.CHAT;
    baseQuestions[3].processMode = ProcessMode.AI_PROCESSED;
  }

  if (scenario.mode === 'BRANCHING') {
    baseQuestions[1].questionType = QuestionType.SINGLE_CHOICE;
    baseQuestions[1].renderMode = RenderMode.RADIO;
    baseQuestions[1].processMode = ProcessMode.OPTION_PROCESSED;
    baseQuestions[1].options = [
      {
        key: 'skip',
        label: 'Skip to question 4',
        value: 'skip',
        index: 0,
        jumpToQuestionId: questionIds[3].toString(),
      },
      {
        key: 'continue',
        label: 'Continue',
        value: 'continue',
        index: 1,
      },
    ];
  }

  const doc = await questionnaireModel.create({
    _id: questionnaireId,
    name: `${scenario.name} questionnaire`,
    code: `QNR_${scenario.name}_${Date.now()}_${new Types.ObjectId().toString().slice(-6)}`,
    description: `${scenario.name} flow`,
    isDynamic: false,
    version: 1,
    startQuestionId: questionIds[0].toString(),
    allowBackNavigation: true,
    allowMultipleSessions: false,
    processingStrategy: ProcessingStrategy.STATIC,
    questions: baseQuestions,
    tags: ['integration-test'],
    metadata: { scenario: scenario.name },
    isActive: true,
  });

  return  toDomain(doc.toObject());
}
