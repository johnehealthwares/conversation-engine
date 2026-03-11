// allow longer setup hooks (downloading mongodb binaries can take a while)
jest.setTimeout(30000);
// explicitly pin mongodb-memory-server binary version early
process.env.MONGOMS_BINARY_VERSION = '6.0.6';
// custom download directory; binaries will be cached here
process.env.MONGOMS_DOWNLOAD_DIR = './mongo-binaries';

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationModule } from './modules/conversation/conversation.module';
import {
  createQuestionnaireData,
  statesOfNigeriaOptionsList,
  countriesOfTheWorldOptionsList,
  genderOptionsList,
  maritalStatusOptionsList,
  educationLevelOptionsList,
  questionWithStatesList,
  questionWithCountriesList,
  questionWithGenderList,
  questionWithMaritalStatusList,
  questionWithEducationList,
  yesNoQuestion,
  frequencyQuestion,
  satisfactionQuestion,
  riskLevelQuestion,
  ageGroupQuestion,
  createQuestionWithEmbeddedOptions,
  genderOptions,
  createQuestionWithOptionList,
} from './fixtures/test-data';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AllExceptionsFilter } from './AllExceptionsFilter';
import { ChannelsModule } from './channels/channels.module';

describe('Questionnaire Integration Tests (E2E)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;


  beforeAll(async () => {
    // ensure memory server uses a stable binary version to avoid SIGABRT crashes
    process.env.MONGOMS_BINARY_VERSION = '6.0.6';
    // Start in-memory MongoDB server for testing
    mongoServer = await MongoMemoryServer.create({
      binary: { version: '6.0.6' },
    });
    const mongoUri = mongoServer.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri, {
          dbName: 'conversation_engine_test',
        }),
        ConversationModule,
        ChannelsModule
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({
      transform: true ,
  whitelist: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors) => {
    // Log the validation errors
    console.log('Validation Errors:', JSON.stringify(errors, null, 2));
    return new BadRequestException(errors);
  },
}));

    await app.init();

  });

  afterAll(async () => {
    await app.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('GET /health or root endpoint', () => {
    it('should return a successful response', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect([200, 404]).toContain(res.status); // 404 is ok for this test
    });
  });

  describe('POST /questionnaires - Create Questionnaire', () => {
    it('should create a questionnaire successfully', async () => {
      const data = createQuestionnaireData();

      const res = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(data)
        .expect(201);

      expect(res.body).toBeDefined();
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(data.name);

    });

    it('should fail if title is missing', async () => {
      const data = { metadata: { test: true } };

      await request(app.getHttpServer())
        .post('/questionnaires')
        .send(data)
        .expect(400);
    });
  });

  describe('GET /questionnaires - List Questionnaires', () => {
    it('should retrieve all questionnaires', async () => {


      const res = await request(app.getHttpServer())
        .get('/questionnaires')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /questionnaires/:id - Get Single Questionnaire', () => {
    it('should retrieve the created questionnaire by ID', async () => {
      const data = createQuestionnaireData();

      const res = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(data)
        .expect(201);

      expect(res.body).toBeDefined();
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(data.name);

      const questionnaireId = res.body.id;

      const res1 = await request(app.getHttpServer())
        .get(`/questionnaires/${questionnaireId}`)
        .expect(200);

      expect(res1.body.id).toBe(questionnaireId);
      expect(res1.body.name).toBe(createQuestionnaireData().name);
    });

    it('should return 404 for non-existent questionnaire', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .get(`/questionnaires/${fakeId}`)
        .expect(404);
    });
  });

  describe('POST /option-lists - Create Option Lists', () => {
    it('should create States of Nigeria option list', async () => {
      const data = statesOfNigeriaOptionsList();

      const res = await request(app.getHttpServer())
        .post('/option-lists')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toContain('States of Nigeria');
      expect(res.body.options.length).toBe(5);

    });

    it('should create Countries of the World option list', async () => {
      const data = countriesOfTheWorldOptionsList();

      const res = await request(app.getHttpServer())
        .post('/option-lists')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toContain('Countries of the World');
      expect(res.body.options.length).toBe(5);

    });

    it('should create Gender option list', async () => {
      const data = genderOptionsList();

      const res = await request(app.getHttpServer())
        .post('/option-lists')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toContain('Gender');
      expect(res.body.options.length).toBe(4);

    });

    it('should create Marital Status option list', async () => {
      const data = maritalStatusOptionsList();



      const res = await request(app.getHttpServer())
        .post('/option-lists')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toContain('Marital Status');
      expect(res.body.options.length).toBe(4);

    });

    it('should create Education Level option list', async () => {
      const data = educationLevelOptionsList();

      const res = await request(app.getHttpServer())
        .post('/option-lists')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toContain('Education Level');
      expect(res.body.options.length).toBe(4);

    });
  });

  describe('GET /option-lists - List Option Lists', () => {
    it('should retrieve all option lists', async () => {
      const res = await request(app.getHttpServer())
        .get('/option-lists')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('GET /option-lists/:id - Get Single Option List', () => {
    it('should retrieve States option list by ID', async () => {

      const optionListRes = await request(app.getHttpServer())
        .post('/option-lists')
        .send(statesOfNigeriaOptionsList());

      expect([200, 201]).toContain(optionListRes.status);
      const optionListId = optionListRes.body.id;

      const res = await request(app.getHttpServer())
        .get(`/option-lists/${optionListId}`)
        .expect(200);

      expect(res.body.id).toBe(optionListId);
      expect(res.body.name).toContain('States of Nigeria');
    });

    it('should return 404 for non-existent option list', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .get(`/option-lists/${fakeId}`)
        .expect(404);
    });
  });

  describe('POST /questions - Create Questions with Option Lists (No Embedded Options)', () => {
    it('should create question with States option list', async () => {
      const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;

      const optionListRes = await request(app.getHttpServer())
        .post('/option-lists')
        .send(genderOptionsList());

      expect([200, 201]).toContain(optionListRes.status);
      const optionListId = optionListRes.body.id;


      const data = questionWithStatesList(questionnaireId, optionListId);

      const res = await request(app.getHttpServer())
        .post('/questions')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.questionnaireId).toBe(questionnaireId);
      expect(res.body.optionListId).toBe(optionListId);
      expect(res.body.options).toBeDefined();

    });

    it('should create question with Countries option list', async () => {
      const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;

      const optionListRes = await request(app.getHttpServer())
        .post('/option-lists')
        .send(countriesOfTheWorldOptionsList());

      expect([200, 201]).toContain(optionListRes.status);
      const optionListId = optionListRes.body.id;

      const data = questionWithCountriesList(questionnaireId, optionListId);

      const res = await request(app.getHttpServer())
        .post('/questions')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.optionListId).toBe(optionListId);

    });

    it('should create question with Gender option list', async () => {
      const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;

      const optionListRes = await request(app.getHttpServer())
        .post('/option-lists')
        .send(genderOptionsList());

      expect([200, 201]).toContain(optionListRes.status);
      const optionListId = optionListRes.body.id;
      const data = questionWithGenderList(questionnaireId, optionListId);

      const res = await request(app.getHttpServer())
        .post('/questions')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.optionListId).toBe(optionListId);

    });

    it('should create question with Marital Status option list', async () => {
      const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;

      const optionListRes = await request(app.getHttpServer())
        .post('/option-lists')
        .send(maritalStatusOptionsList());

      expect([200, 201]).toContain(optionListRes.status);

      const optionListId = optionListRes.body.id;
      const data = questionWithMaritalStatusList(questionnaireId, optionListId);

      const res = await request(app.getHttpServer())
        .post('/questions')
        .send(data)
        .expect(201);
      
      

      expect(res.body.id).toBeDefined();
      expect(res.body.optionListId).toBe(optionListId);

    });

    it('should create question with Education option list', async () => {
       const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;

      const optionListRes = await request(app.getHttpServer())
      .post('/option-lists')
      .send(educationLevelOptionsList());

    expect([200, 201]).toContain(optionListRes.status);
      const optionListId = optionListRes.body.id;
      const data = questionWithEducationList(questionnaireId, optionListId);

      const res = await request(app.getHttpServer())
        .post('/questions')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.optionListId).toBe(optionListId);

    });


  });

  describe('POST /questions - Create Questions with Embedded Options (No Option Lists)', () => {
    it('should create Yes/No question with embedded options', async () => {
       const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;

      const data = yesNoQuestion(questionnaireId);

      const res = await request(app.getHttpServer())
        .post('/questions')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.questionnaireId).toBe(questionnaireId);
      expect(res.body.options).toBeDefined();
      expect(res.body.options.length).toBe(2);
      expect(res.body.optionListId).toBeUndefined();

    });

    it('should create Frequency question with embedded options', async () => {
       const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;

      const data = frequencyQuestion(questionnaireId);

      const res = await request(app.getHttpServer())
        .post('/questions')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.options).toBeDefined();
      expect(res.body.options.length).toBe(4);

    });

    it('should create Satisfaction question with embedded options', async () => {
       const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;

      const data = satisfactionQuestion(questionnaireId);

      const res = await request(app.getHttpServer())
        .post('/questions')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.options).toBeDefined();
      expect(res.body.options.length).toBe(5);

    });

    it('should create Risk Level question with embedded options', async () => {
       const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;

      const data = riskLevelQuestion(questionnaireId);

      const res = await request(app.getHttpServer())
        .post('/questions')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.options).toBeDefined();
      expect(res.body.options.length).toBe(4);

    });

    it('should create Age Group question with embedded options', async () => {
       const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;

      const data = ageGroupQuestion(questionnaireId);

      const res = await request(app.getHttpServer())
        .post('/questions')
        .send(data)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.options).toBeDefined();
      expect(res.body.options.length).toBe(5);

    });

  });

  describe('GET /questions - List Questions', () => {
    it('should retrieve all questions', async () => {
      const res = await request(app.getHttpServer())
        .get('/questions')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(10);
    });

    it('should retrieve questions filtered by questionnaire', async () => {

      const data = createQuestionnaireData();

      let res = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(data)
        .expect(201);
      expect(res.body).toBeDefined();
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(data.name);
      const questionnaireId = res.body.id;

        const questionWithOptionList = await request(app.getHttpServer())
      .post('/questions')
      .send(createQuestionWithEmbeddedOptions(questionnaireId,  1, "State", statesOfNigeriaOptionsList().options));


      const res1 = await request(app.getHttpServer())
        .get(`/questions?questionnaireId=${questionnaireId}`)
        .expect(200);
      expect(Array.isArray(res1.body)).toBe(true);
      expect(res1.body.length).toBe(1); // 5 with list + 5 with embedded
    });
  });

  describe('GET /questions/:id - Get Single Question', () => {
    
    it('should create and get  a question with option list by ID', async () => {

       // create option list
    const optionListRes = await request(app.getHttpServer())
      .post('/option-lists')
      .send(statesOfNigeriaOptionsList());

    expect([200, 201]).toContain(optionListRes.status);
    const optionListId = optionListRes.body.id

   

     const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;


    // create question that uses option list
    const questionWithOptionList = await request(app.getHttpServer())
      .post('/questions')
      .send(createQuestionWithOptionList(questionnaireId, optionListId, 1, "State"));

    expect([200, 201]).toContain(questionWithOptionList.status);
     expect(questionWithOptionList.body.id).toBeDefined()
         const questionId = questionWithOptionList.body.id;
      console.log('id of q', questionId)


      const res = await request(app.getHttpServer())
        .get(`/questions/${questionId}`)
        .expect(200);

      expect(res.body.id).toBe(questionId);
      expect(res.body.options).toBeDefined();
  

    });


    it('should return 404 for non-existent question', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app.getHttpServer())
        .get(`/questions/${fakeId}`)
        .expect(404);
    });
  });

  describe('PUT /questions/:id - Update Question', () => {
    it('should update a question successfully', async () => {


       // create option list
    const optionListRes = await request(app.getHttpServer())
      .post('/option-lists')
      .send(statesOfNigeriaOptionsList());

    expect([200, 201]).toContain(optionListRes.status);
    const optionListId = optionListRes.body.id

   

     const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;


    // create question that uses option list
    const questionWithOptionList = await request(app.getHttpServer())
      .post('/questions')
      .send(createQuestionWithOptionList(questionnaireId, optionListId, 1, "State"));

    expect([200, 201]).toContain(questionWithOptionList.status);
     expect(questionWithOptionList.body.id).toBeDefined()
         const questionId = questionWithOptionList.body.id;

      const updateData = {
        text: 'Updated question text',
        isRequired: false,
      };

      const res = await request(app.getHttpServer())
        .put(`/questions/${questionId}`)
        .send(updateData)
        .expect(200);

      expect(res.body.id).toBe(questionId);
      expect(res.body.text).toBe(updateData.text);
      expect(res.body.isRequired).toBe(updateData.isRequired);
    });
  });

  describe('DELETE /questions/:id - Delete Question', () => {
    it('should delete a question successfully', async () => {

       // create option list
    const optionListRes = await request(app.getHttpServer())
      .post('/option-lists')
      .send(statesOfNigeriaOptionsList());

    expect([200, 201]).toContain(optionListRes.status);
    const optionListId = optionListRes.body.id

   

     const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;


    // create question that uses option list
    const questionWithOptionList = await request(app.getHttpServer())
      .post('/questions')
      .send(createQuestionWithOptionList(questionnaireId, optionListId, 1, "State"));

    expect([200, 201]).toContain(questionWithOptionList.status);
     expect(questionWithOptionList.body.id).toBeDefined()
         const questionId = questionWithOptionList.body.id;


      await request(app.getHttpServer())
        .delete(`/questions/${questionId}`)
        .expect(200);

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/questions/${questionId}`)
        .expect(404);
    });
  });

  describe('PATCH /questionnaires/:id - Update Questionnaire', () => {
    it('should update a questionnaire', async () => {
      const data = createQuestionnaireData();

      let res = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(data)
        .expect(201);
      expect(res.body).toBeDefined();
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(data.name);
      const questionnaireId = res.body.id;

      const updateData = {
        name: 'Updated Questionnaire Title ' + new Date().getTime(),
      };

      res = await request(app.getHttpServer())
        .patch(`/questionnaires/${questionnaireId}`)
        .send(updateData)
        .expect(200);

      expect(res.body.id).toBe(questionnaireId);
      expect(res.body.name).toBe(updateData.name);
    });
  });

  describe('DELETE /option-lists/:id - Delete Option List (Should fail if in use)', () => {
    it('should fail to delete option list in use by questions', async () => {

       // create option list
    const optionListRes = await request(app.getHttpServer())
      .post('/option-lists')
      .send(statesOfNigeriaOptionsList());

    expect([200, 201]).toContain(optionListRes.status);
    const optionListId = optionListRes.body.id

   

     const questionnaire = createQuestionnaireData();

      let res0 = await request(app.getHttpServer())
        .post('/questionnaires')
        .send(questionnaire)
        .expect(201);
      expect(res0.body).toBeDefined();
      expect(res0.body.id).toBeDefined();
      expect(res0.body.name).toBe(questionnaire.name);
      const questionnaireId = res0.body.id;


    // create question that uses option list
    const questionWithOptionList = await request(app.getHttpServer())
      .post('/questions')
      .send(createQuestionWithOptionList(questionnaireId, optionListId, 1, "State"));

    expect([200, 201]).toContain(questionWithOptionList.status);
     expect(questionWithOptionList.body.id).toBeDefined()
      const questionId = questionWithOptionList.body.id;


   
      // This should fail because the option list is referenced by questions
      await request(app.getHttpServer())
        .delete(`/option-lists/${optionListId}`)
        .expect(400); // BadRequestException
    });
  });


});