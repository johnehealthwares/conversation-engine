import { INestApplicationContext } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question } from '../modules/questionnaire/schemas/question.schema';
import { Questionnaire } from '../modules/questionnaire/schemas/questionnaire.schema';
import { Workflow } from '../modules/workflow/entities/workflow';
import {
  ProcessMode,
  ProcessingStrategy,
  QuestionType,
  RenderMode,
} from '../shared/domain';
import {
  SeedQuestionnaire,
  loadQuestionnaireSeeds,
} from './questionnaire-seed-loader';

type SeedResult = {
  created: number;
  updated: number;
  skipped: number;
};

function buildAttribute(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getBuiltInQuestionnaireSeeds(): SeedQuestionnaire[] {
  return [
    {
      referenceCode: 'APPOINTMENT_SCHEDULING_AUTH',
      name: 'Appointment Scheduling With Client Lookup',
      code: 'APPOINTMENT_SCHEDULING_AUTH',
      description:
        'Collect appointment data, resolve the client from HS-backend, and submit through a workflow-authenticated Feathers call.',
      introduction:
        'Let us schedule your appointment. Please enter the patient phone number, email, or name to find the client record.',
      conclusion: 'Appointment request submitted.',
      endPhrase: 'STOP',
      isDynamic: false,
      version: 1,
      allowBackNavigation: true,
      allowMultipleSessions: false,
      processingStrategy: ProcessingStrategy.STATIC,
      isActive: true,
      tags: ['appointments', 'workflow', 'authentication', 'client-lookup'],
      workflowCode: 'WF_APPOINTMENT_SCHEDULING_AUTH_SUBMISSION',
      startQuestionReferenceCode: 'APPOINTMENT_SCHEDULING_AUTH__client_lookup',
      metadata: {
        source: 'built-in',
        submissionUrl: '{{env.HS_BACKEND_BASE_URL}}/appointments',
      },
      questions: [
        {
          referenceCode: 'APPOINTMENT_SCHEDULING_AUTH__client_lookup',
          attribute: 'client_lookup',
          text: 'Enter the patient phone number, email, or name.',
          questionType: QuestionType.TEXT,
          renderMode: RenderMode.INPUT,
          processMode: ProcessMode.API_PROCESSED,
          index: 1,
          isRequired: true,
          isActive: true,
          hasLink: false,
          tags: ['appointments', 'client-lookup'],
          apiNavigation: {
            url: '{{env.HS_BACKEND_BASE_URL}}/client?$limit=10&$or[0][phone]={{encodedAnswer}}&$or[1][email][$regex]={{encodedAnswer}}&$or[1][email][$options]=i&$or[2][firstname][$regex]={{encodedAnswer}}&$or[2][firstname][$options]=i&$or[3][lastname][$regex]={{encodedAnswer}}&$or[3][lastname][$options]=i',
            method: 'GET',
            headers: {
              Authorization: 'eyJhbGciOiJIUzI1NiIsInR5cCI6ImFjY2VzcyJ9.eyJpYXQiOjE3NzQwNTcxNTcsImV4cCI6MTc3NDE0MzU1NywiYXVkIjoiaHR0cHM6Ly95b3VyZG9tYWluLmNvbSIsImlzcyI6ImZlYXRoZXJzIiwic3ViIjoiNjA1NGFlZDgzN2JjNDkwMDE1ZjU2ZmU4IiwianRpIjoiZGUxNDY4NDUtM2JjZS00MDk3LWE1NzUtNGFkODljNTA2YWQ3In0.LJFPhOGps6DjsrvVWdzVmE78fIJTt55Fbw__gQUjh3w',
            },
            responseMapping: {
              metadataKey: 'clientMatches',
            },
            followUpRequests: [
              {
                url: '{{env.HS_BACKEND_BASE_URL}}/facility?$limit=100&active=true',
                method: 'GET',
                condition: 'metadata.count > 0',
                responseMapping: {
                  metadataKey: 'facilities',
                },
              },
            ],
            conditions: [
              {
                condition: 'response.length === 0',
                nextQuestionId: 'client_lookup_retry',
              },
              {
                condition: 'response.length > 1',
                nextQuestionId: 'clientId',
              },
              {
                condition: 'response.length === 1',
                nextQuestionId: 'facility',
              },
            ],
            defaultNextQuestionId: 'client_lookup_retry',
          },
          validationRules: [
            {
              type: 'required',
              message: 'Enter the patient phone number, email, or name.',
            },
          ],
        },
        {
          referenceCode: 'APPOINTMENT_SCHEDULING_AUTH__client_lookup_retry',
          attribute: 'client_lookup_retry',
          text: 'No matching client was found. Reply 1 to search again.',
          questionType: QuestionType.SINGLE_CHOICE,
          renderMode: RenderMode.RADIO,
          processMode: ProcessMode.OPTION_PROCESSED,
          index: 2,
          isRequired: true,
          isActive: true,
          hasLink: false,
          tags: ['appointments', 'client-lookup'],
          options: [
            {
              referenceCode: 'APPOINTMENT_SCHEDULING_AUTH__client_lookup_retry__retry',
              key: '1',
              value: 'retry',
              label: 'Search again',
              index: 1,
              jumpToQuestionReferenceCode:
                'APPOINTMENT_SCHEDULING_AUTH__client_lookup',
            },
          ],
        },
        {
          referenceCode: 'APPOINTMENT_SCHEDULING_AUTH__clientId',
          attribute: 'clientId',
          text: 'Confirm the client.',
          questionType: QuestionType.SINGLE_CHOICE,
          renderMode: RenderMode.DROPDOWN,
          processMode: ProcessMode.OPTION_PROCESSED,
          index: 3,
          isRequired: true,
          isActive: true,
          hasLink: false,
          tags: ['appointments', 'client-confirmation'],
          optionSource: {
            type: 'METADATA',
            metadataKey: 'clientMatches',
            labelKey: 'displayLabel',
            valueKey: 'id',
            jumpToQuestionId: 'facility',
          },
        },
        {
          referenceCode: 'APPOINTMENT_SCHEDULING_AUTH__facility',
          attribute: 'facility',
          text: 'Choose the facility.',
          questionType: QuestionType.SINGLE_CHOICE,
          renderMode: RenderMode.DROPDOWN,
          processMode: ProcessMode.OPTION_PROCESSED,
          index: 4,
          isRequired: true,
          isActive: true,
          hasLink: false,
          tags: ['appointments', 'facility'],
          optionSource: {
            type: 'METADATA',
            metadataKey: 'facilities',
            labelKey: 'displayLabel',
            valueKey: 'id',
          },
          nextQuestionReferenceCode:
            'APPOINTMENT_SCHEDULING_AUTH__appointment_type',
        },
        {
          referenceCode: 'APPOINTMENT_SCHEDULING_AUTH__appointment_type',
          attribute: 'appointment_type',
          text: 'Select the appointment type.',
          questionType: QuestionType.SINGLE_CHOICE,
          renderMode: RenderMode.DROPDOWN,
          processMode: ProcessMode.OPTION_PROCESSED,
          index: 5,
          isRequired: true,
          isActive: true,
          hasLink: false,
          tags: ['appointments', 'type'],
          nextQuestionReferenceCode: 'APPOINTMENT_SCHEDULING_AUTH__date',
          options: [
            {
              referenceCode:
                'APPOINTMENT_SCHEDULING_AUTH__appointment_type__laboratory',
              key: '1',
              value: 'laboratory',
              label: 'Laboratory',
              index: 1,
            },
            {
              referenceCode:
                'APPOINTMENT_SCHEDULING_AUTH__appointment_type__radiology',
              key: '2',
              value: 'radiology',
              label: 'Radiology',
              index: 2,
            },
            {
              referenceCode:
                'APPOINTMENT_SCHEDULING_AUTH__appointment_type__clinic',
              key: '3',
              value: 'Clinic',
              label: 'Clinic',
              index: 3,
            },
            {
              referenceCode:
                'APPOINTMENT_SCHEDULING_AUTH__appointment_type__emergency',
              key: '4',
              value: 'Emergency',
              label: 'Emergency',
              index: 4,
            },
          ],
        },
        {
          referenceCode: 'APPOINTMENT_SCHEDULING_AUTH__date',
          attribute: 'date',
          text: 'Enter the appointment date in YYYY-MM-DD format.',
          questionType: QuestionType.DATE,
          renderMode: RenderMode.INPUT,
          processMode: ProcessMode.NONE,
          index: 6,
          isRequired: true,
          isActive: true,
          hasLink: false,
          tags: ['appointments', 'date'],
          validationRules: [
            {
              type: 'question-type',
            },
          ],
        },
      ],
    },
    {
      referenceCode: 'WF_DYNAMIC_FACILITY_Q',
      name: 'Workflow-driven Facility Lookup Questionnaire',
      code: 'WF_DYNAMIC_FACILITY_Q',
      description:
        'Collects a customer name, resolves facilities through the workflow engine, and captures an appointment date.',
      introduction: 'Welcome. Please answer the following questions to schedule your appointment.',
      conclusion: 'Thank you. Your appointment request has been captured.',
      endPhrase: 'STOP',
      isDynamic: false,
      version: 1,
      allowBackNavigation: true,
      allowMultipleSessions: false,
      processingStrategy: ProcessingStrategy.STATIC,
      isActive: true,
      tags: ['workflow', 'dynamic-options', 'facility', 'appointment'],
      workflowCode: 'WF_DYNAMIC_FACILITY_LOOKUP',
      startQuestionReferenceCode: 'WF_DYNAMIC_FACILITY_Q__customer_name',
      metadata: {
        source: 'built-in',
        purpose: 'Demonstrates workflow-driven dynamic option lookup.',
      },
      questions: [
        {
          referenceCode: 'WF_DYNAMIC_FACILITY_Q__customer_name',
          attribute: 'customer_name',
          text: 'What is the customer name?',
          questionType: QuestionType.TEXT,
          renderMode: RenderMode.INPUT,
          processMode: ProcessMode.NONE,
          index: 1,
          isRequired: true,
          isActive: true,
          hasLink: false,
          tags: ['workflow', 'dynamic-options'],
          nextQuestionReferenceCode: 'WF_DYNAMIC_FACILITY_Q__facilityId',
          validationRules: [
            {
              type: 'question-type',
            },
          ],
        },
        {
          referenceCode: 'WF_DYNAMIC_FACILITY_Q__facilityId',
          attribute: 'facilityId',
          text: 'Enter the facility name to search for a match.',
          questionType: QuestionType.TEXT,
          renderMode: RenderMode.INPUT,
          processMode: ProcessMode.WORKFLOW_PROCESSED,
          index: 2,
          isRequired: true,
          isActive: true,
          hasLink: false,
          tags: ['workflow', 'dynamic-options', 'facility'],
          nextQuestionReferenceCode: 'WF_DYNAMIC_FACILITY_Q__appointment_date',
          validationRules: [
            {
              type: 'required',
              message: 'Enter a facility name before continuing.',
            },
          ],
        },
        {
          referenceCode: 'WF_DYNAMIC_FACILITY_Q__appointment_date',
          attribute: 'appointment_date',
          text: 'Enter the appointment date in YYYY-MM-DD format.',
          questionType: QuestionType.DATE,
          renderMode: RenderMode.INPUT,
          processMode: ProcessMode.NONE,
          index: 3,
          isRequired: true,
          isActive: true,
          hasLink: false,
          tags: ['workflow', 'dynamic-options', 'appointment'],
          validationRules: [
            {
              type: 'question-type',
            },
          ],
        },
      ],
    },
    {
      referenceCode: 'WF_SAMPLE_Q',
      name: 'Sample Workflow Questionnaire',
      code: 'WF_SAMPLE_Q',
      description:
        'Sample questionnaire aligned with the sample workflow notification and submission seed.',
      introduction: 'Welcome. Please answer the following questions.',
      conclusion: 'Thank you. Your submission has been queued.',
      endPhrase: 'STOP',
      isDynamic: false,
      version: 1,
      allowBackNavigation: true,
      allowMultipleSessions: false,
      processingStrategy: ProcessingStrategy.STATIC,
      isActive: true,
      tags: ['sample', 'workflow', 'notification', 'submission'],
      workflowCode: 'WF_SAMPLE_NOTIFICATION_AND_SUBMISSION',
      startQuestionReferenceCode: 'WF_SAMPLE_Q__patient_number',
      metadata: {
        source: 'built-in',
        purpose:
          'Demonstrates invalid-answer notification, specific-value notification, and final form submission.',
      },
      questions: [
        {
          referenceCode: 'WF_SAMPLE_Q__patient_number',
          attribute: 'patient_number',
          text: 'What is the patient number? Use the format PN-001.',
          questionType: QuestionType.TEXT,
          renderMode: RenderMode.INPUT,
          processMode: ProcessMode.NONE,
          index: 1,
          isRequired: true,
          isActive: true,
          hasLink: false,
          tags: ['sample', 'workflow'],
          nextQuestionReferenceCode: 'WF_SAMPLE_Q__patient_dob',
          validationRules: [
            {
              type: 'question-type',
            },
            {
              type: 'regex',
              value: '^PN-[0-9]{3,}$',
              message: 'Patient number must match the format PN-001.',
            },
          ],
        },
        {
          referenceCode: 'WF_SAMPLE_Q__patient_dob',
          attribute: 'patient_dob',
          text: 'What is the patient date of birth? Use YYYY-MM-DD.',
          questionType: QuestionType.DATE,
          renderMode: RenderMode.INPUT,
          processMode: ProcessMode.NONE,
          index: 2,
          isRequired: true,
          isActive: true,
          hasLink: false,
          tags: ['sample', 'workflow'],
          nextQuestionReferenceCode: 'WF_SAMPLE_Q__consent',
          validationRules: [
            {
              type: 'question-type',
            },
          ],
        },
        {
          referenceCode: 'WF_SAMPLE_Q__consent',
          attribute: 'consent',
          text: 'Do you consent to submit this form?',
          questionType: QuestionType.SINGLE_CHOICE,
          renderMode: RenderMode.RADIO,
          processMode: ProcessMode.OPTION_PROCESSED,
          index: 3,
          isRequired: true,
          isActive: true,
          hasLink: false,
          tags: ['sample', 'workflow'],
          validationRules: [
            {
              type: 'question-type',
            },
          ],
          options: [
            {
              referenceCode: 'WF_SAMPLE_Q__consent__yes',
              key: 'Y',
              value: 'yes',
              label: 'Yes',
              index: 1,
            },
            {
              referenceCode: 'WF_SAMPLE_Q__consent__no',
              key: 'N',
              value: 'no',
              label: 'No',
              index: 2,
            },
          ],
        },
      ],
    },


    {
      referenceCode: 'WF_APPOINTMENT_Q',
      name: 'Appointment Booking Flow',
      code: 'WF_APPOINTMENT_Q',
      description: 'Collects appointment details and uses workflow for dynamic resolution of facility, location, and client.',
      introduction: 'Welcome. Let’s book your appointment.',
      conclusion: 'Your appointment has been successfully created.',
      endPhrase: 'STOP',

      isDynamic: false,
      version: 1,
      isActive: true,

      allowBackNavigation: true,
      allowMultipleSessions: false,

      processingStrategy: ProcessingStrategy.STATIC,

      workflowCode: 'WF_APPOINTMENT_BOOKING',

      startQuestionReferenceCode: 'WF_APPT_Q__appointment_type',

      metadata: {
        source: 'built-in',
        purpose: 'appointment-booking',
      },

      tags: ['appointment', 'workflow', 'dynamic-options'],

      questions: [

        // 🟦 APPOINTMENT TYPE
        {
          referenceCode: 'WF_APPT_Q__appointment_type',

          attribute: 'appointment_type',
          text: 'Select appointment type',
          description: 'Choose the type of appointment you want to book',

          questionType: QuestionType.SINGLE_CHOICE,
          renderMode: RenderMode.RADIO,
          processMode: ProcessMode.OPTION_PROCESSED,

          index: 1,
          isRequired: true,
          isActive: true,

          hasLink: false,

          tags: ['appointment'],

          options: [
            {
              key: 'new', label: 'New', value: 'New',
              referenceCode: '',
              index: 0
            },
            {
              key: 'followup', label: 'Follow Up', value: 'FollowUp',
              referenceCode: '',
              index: 0
            },
            {
              key: 'admission', label: 'Admission', value: 'Admission',
              referenceCode: '',
              index: 0
            },
            {
              key: 'annual', label: 'Annual Checkup', value: 'Annual Checkup',
              referenceCode: '',
              index: 0
            },
          ],
          nextQuestionReferenceCode: 'WF_APPT_Q__facilityId',
          validationRules: [
            { type: 'required' },
          ],
        },

        // 🏥 FACILITY
        {
          referenceCode: 'WF_APPT_Q__facilityId',

          attribute: 'facilityId',
          text: 'Enter facility name',
          description: 'We will search for matching facilities',

          questionType: QuestionType.TEXT,
          renderMode: RenderMode.INPUT,
          processMode: ProcessMode.WORKFLOW_PROCESSED,

          index: 2,
          isRequired: true,
          isActive: true,

          hasLink: false,

          tags: ['facility', 'workflow'],

          previousQuestionReferenceCode: 'WF_APPT_Q__appointment_type',
          nextQuestionReferenceCode: 'WF_APPT_Q__locationId',

          validationRules: [
            {
              type: 'required',
              message: 'Facility name is required',
            },
          ],
        },

        // 📍 LOCATION
        {
          referenceCode: 'WF_APPT_Q__locationId',

          attribute: 'locationId',
          text: 'Select location',
          description: 'We will load locations for the facility you selected',

          questionType: QuestionType.WORKFLOW_CHOICE,
          renderMode: RenderMode.DROPDOWN,
          processMode: ProcessMode.NONE,

          index: 3,
          isRequired: true,
          isActive: true,

          hasLink: false,

          tags: ['location', 'workflow'],

          previousQuestionReferenceCode: 'WF_APPT_Q__facilityId',
          nextQuestionReferenceCode: 'WF_APPT_Q__clientId',

          validationRules: [
            {
              type: 'required',
              message: 'Select a location to continue',
            },
          ],

        },

        // 👤 CLIENT
        {
          referenceCode: 'WF_APPT_Q__clientId',

          attribute: 'clientId',
          text: 'Enter phone number or hospital number',
          description: 'We will locate the patient record',

          questionType: QuestionType.TEXT,
          renderMode: RenderMode.INPUT,
          processMode: ProcessMode.WORKFLOW_PROCESSED,

          index: 4,
          isRequired: true,
          isActive: true,

          hasLink: false,

          tags: ['client', 'workflow'],

          previousQuestionReferenceCode: 'WF_APPT_Q__locationId',
          nextQuestionReferenceCode: 'WF_APPT_Q__start_time',

          validationRules: [
            {
              type: 'required',
              message: 'Phone number or hospital number is required',
            },
          ],

        },

        // 📅 DATE
        {
          referenceCode: 'WF_APPT_Q__start_time',

          attribute: 'start_time',
          text: 'Enter appointment date (YYYY-MM-DD)',
          description: 'Provide a valid date',

          questionType: QuestionType.DATE,
          renderMode: RenderMode.INPUT,
          processMode: ProcessMode.NONE,

          index: 5,
          isRequired: true,
          isActive: true,

          hasLink: false,

          tags: ['date'],

          previousQuestionReferenceCode: 'WF_APPT_Q__clientId',

          validationRules: [
            { type: 'required' },
            { type: 'question-type' },
          ],

        },
      ],
    }
  ];
}

export async function seedQuestionnaires(
  app: INestApplicationContext,
): Promise<SeedResult> {
  console.log('Loading questionnaire seed source...');
  const questionnaireModel = app.get<Model<Questionnaire>>(
    getModelToken(Questionnaire.name),
  );
  const questionModel = app.get<Model<Question>>(getModelToken(Question.name));
  const workflowModel = app.get<Model<Workflow>>(getModelToken(Workflow.name));

  const loadedData = await loadQuestionnaireSeeds(process.cwd());
  const data = [...loadedData, ...getBuiltInQuestionnaireSeeds()];
  console.log(`Loaded ${data.length} questionnaire definitions from seed source.`);
  if (!data.length) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  const questionnaireCodes = data.map((item) => item.code);
  const existingQuestionnaires = await questionnaireModel
    .find({ code: { $in: questionnaireCodes } }, { code: 1 })
    .lean();

  const existingByCode = new Map<string, { id: string }>(
    existingQuestionnaires.map((item: any) => [
      item.code,
      { id: item._id.toString() },
    ]),
  );

  const questionnaireIdByReference = new Map<string, string>();
  const requestedWorkflowCodes = [
    ...new Set(
      data
        .map((item) => item.workflowCode?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const workflowsByCode = new Map<string, string>();

  if (requestedWorkflowCodes.length > 0) {
    const workflows = await workflowModel
      .find({ code: { $in: requestedWorkflowCodes } }, { code: 1 })
      .lean();

    for (const workflow of workflows as Array<{ code: string; _id: Types.ObjectId }>) {
      workflowsByCode.set(workflow.code, workflow._id.toString());
    }
  }

  const itemsToSync: Array<
    SeedQuestionnaire & {
      generatedId: Types.ObjectId
      exists: boolean;
      resolvedWorkflowId?: string;
    }
  > = [];

  for (const item of data) {
    const existing = existingByCode.get(item.code);
    const generatedId = existing ? new Types.ObjectId(existing.id) : new Types.ObjectId();
    const resolvedWorkflowId =
      item.workflowCode && workflowsByCode.has(item.workflowCode)
        ? workflowsByCode.get(item.workflowCode)
        : item.workflowId;

    if (item.workflowCode && !resolvedWorkflowId) {
      console.warn(
        `Workflow with code "${item.workflowCode}" was not found for questionnaire "${item.code}". The questionnaire will be seeded without a workflowId.`,
      );
    }

    questionnaireIdByReference.set(item.referenceCode, generatedId.toString());
    questionnaireIdByReference.set(item.code, generatedId.toString());
    itemsToSync.push({
      ...item,
      generatedId,
      exists: Boolean(existing),
      resolvedWorkflowId,
    });
  }

  let created = 0;
  let updated = 0;

  console.log(
    `Syncing ${itemsToSync.length} questionnaires to MongoDB...`,
  );

  for (const item of itemsToSync) {
    const sortedQuestions = [...(item.questions || [])].sort(
      (left, right) => left.index - right.index,
    );

    const questionIdByReference = new Map<string, Types.ObjectId>();
    for (const question of sortedQuestions) {
      questionIdByReference.set(question.referenceCode, new Types.ObjectId());
    }

    const embeddedQuestions = sortedQuestions.map((question) => ({
      _id: questionIdByReference.get(question.referenceCode)!,
      questionnaireId: item.generatedId,
      attribute: question.attribute || buildAttribute(question.text),
      text: question.text,
      description: question.description,
      hasLink: question.hasLink ?? false,
      index: question.index,
      tags: question.tags || [],
      questionType: question.questionType,
      renderMode: question.renderMode,
      processMode: question.processMode,
      isRequired: question.isRequired ?? false,
      isActive: question.isActive ?? true,
      previousQuestionId: question.previousQuestionReferenceCode
        ? questionIdByReference
          .get(question.previousQuestionReferenceCode)
          ?.toString()
        : undefined,
      nextQuestionId: question.nextQuestionReferenceCode
        ? questionIdByReference.get(question.nextQuestionReferenceCode)?.toString()
        : undefined,
      childQuestionnaireId: question.childQuestionnaireReferenceCode
        ? questionnaireIdByReference.get(question.childQuestionnaireReferenceCode)
        : undefined,
      options: [...(question.options || [])]
        .sort((left, right) => left.index - right.index)
        .map((option) => ({
          _id: new Types.ObjectId(),
          key: option.key,
          value: option.value,
          label: option.label,
          index: option.index,
          jumpToQuestionId: option.jumpToQuestionReferenceCode
            ? questionIdByReference
              .get(option.jumpToQuestionReferenceCode)
              ?.toString()
            : undefined,
          backToQuestionId: option.backToQuestionReferenceCode
            ? questionIdByReference
              .get(option.backToQuestionReferenceCode)
              ?.toString()
            : undefined,
          childQuestionnaireId: option.childQuestionnaireReferenceCode
            ? questionnaireIdByReference.get(option.childQuestionnaireReferenceCode)
            : undefined,
          metadata: option.metadata,
        })),
      aiConfig: question.aiConfig,
      optionSource: question.optionSource,
      apiNavigation: question.apiNavigation,
      validationRules: question.validationRules || [],
      metadata: question.metadata,
    }));

    const startQuestionId = item.startQuestionReferenceCode
      ? questionIdByReference.get(item.startQuestionReferenceCode)?.toString()
      : embeddedQuestions[0]?._id?.toString();

    const questionnairePayload = {
      _id: item.generatedId,
      name: item.name,
      introduction: item.introduction,
      conclusion: item.conclusion,
      code: item.code,
      description: item.description,
      isDynamic: item.isDynamic,
      version: item.version,
      startQuestionId,
      workflowId: item.resolvedWorkflowId,
      endPhrase: item.endPhrase || 'STOP',
      allowBackNavigation: item.allowBackNavigation,
      allowMultipleSessions: item.allowMultipleSessions,
      processingStrategy: item.processingStrategy,
      questions: embeddedQuestions,
      tags: item.tags || [],
      metadata: item.metadata,
      isActive: item.isActive,
    };

    await questionnaireModel.replaceOne(
      { _id: item.generatedId },
      questionnairePayload,
      { upsert: true },
    );

    await questionModel.deleteMany({ questionnaireId: item.generatedId });

    if (embeddedQuestions.length > 0) {
      await questionModel.insertMany(embeddedQuestions, { ordered: true });
    }

    if (item.exists) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  console.log(
    `Questionnaire sync finished. created=${created} updated=${updated}`,
  );

  return { created, updated, skipped: 0 };
}
