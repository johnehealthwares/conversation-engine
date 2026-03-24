import { INestApplicationContext } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workflow } from '../modules/workflow/entities/workflow';

type SeedResult = {
  created: number;
  updated: number;
  skipped: number;
};

type SeedWorkflow = {
  _id: Types.ObjectId;
  name: string;
  code: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  steps: Array<{
    id: string;
    type: 'QUESTIONNAIRE' | 'ACTION' | 'WAIT' | 'END';
    config?: Record<string, any>;
    transitions: Array<{
      event: string;
      condition?: string;
      nextStepId: string;
    }>;
  }>;
};

const sampleWorkflows = (): SeedWorkflow[] => [
  {
    _id: new Types.ObjectId('680000000000000000000001'),
    name: 'Sample Workflow - Invalid Answer Notification, Specific Value Notification, and Final Submission',
    code: 'WF_SAMPLE_NOTIFICATION_AND_SUBMISSION',
    metadata: {
      purpose: 'sample',
      description:
        'Demonstrates notification on invalid answer, notification on specific answer value, and form submission on conversation completion.',
      expectedQuestionnaireAttributes: [
        'patient_number',
        'patient_dob',
        'consent',
      ],
      notes: {
        invalidNotification:
          'When patient_number fails validation on the questionnaire step, the workflow posts to the invalid-answer webhook.',
        specificValueNotification:
          'When patient_dob equals 2000-01-01, the workflow posts a special notification before continuing.',
        finalSubmission:
          'When the conversation completes, the workflow posts the mapped form submission payload.',
      },
    },
    isActive: true,
    steps: [
      {
        id: 'patient_number',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'ANSWER_INVALID',
            nextStepId: 'notify_invalid_patient_number',
          },
          {
            event: 'ANSWER_VALID',
            nextStepId: 'patient_dob',
          },
        ],
      },
      {
        id: 'notify_invalid_patient_number',
        type: 'ACTION',
        config: {
          action: 'HTTP_POST',
          url: 'https://example.test/webhooks/invalid-patient-number',
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'patient_number',
          },
          {
            event: 'ACTION_FAILED',
            nextStepId: 'patient_number',
          },
        ],
      },
      {
        id: 'patient_dob',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'ANSWER_VALID',
            condition: "payload.patient_dob === '2000-01-01'",
            nextStepId: 'notify_special_dob',
          },
          {
            event: 'ANSWER_VALID',
            nextStepId: 'consent',
          },
        ],
      },
      {
        id: 'notify_special_dob',
        type: 'ACTION',
        config: {
          action: 'HTTP_POST',
          url: 'https://example.test/webhooks/special-dob-notification',
          mapping: {
            patientNumber: 'patient_number',
            patientDob: 'patient_dob',
          },
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'consent',
          },
          {
            event: 'ACTION_FAILED',
            nextStepId: 'consent',
          },
        ],
      },
      {
        id: 'consent',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'CONVERSATION_COMPLETED',
            nextStepId: 'submit_completed_form',
          },
        ],
      },
      {
        id: 'submit_completed_form',
        type: 'ACTION',
        config: {
          action: 'HTTP_POST',
          url: 'https://example.test/forms/sample-conversation-submit',
          mapping: {
            patientNumber: 'patient_number',
            patientDob: 'patient_dob',
            consent: 'consent',
          },
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'done',
          },
        ],
      },
      {
        id: 'done',
        type: 'END',
        transitions: [],
      },
    ],
  },
  {
    _id: new Types.ObjectId('680000000000000000000002'),
    name: 'Appointment Scheduling Workflow With Authentication Submission',
    code: 'WF_APPOINTMENT_SCHEDULING_AUTH_SUBMISSION',
    metadata: {
      purpose: 'appointment-scheduling',
      description:
        'Looks up a client, collects appointment details, fetches a Feathers authentication token, and submits the appointment.',
      submissionUrl: '{{env.HS_BACKEND_BASE_URL}}/appointments',
      authenticationUrl: '{{env.HS_BACKEND_BASE_URL}}/authentication',
    },
    isActive: true,
    steps: [
      {
        id: 'client_lookup',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'ANSWER_VALID',
            condition: 'count === 0',
            nextStepId: 'client_lookup_retry',
          },
          {
            event: 'ANSWER_VALID',
            condition: 'count > 1',
            nextStepId: 'clientId',
          },
          {
            event: 'ANSWER_VALID',
            condition: 'count === 1',
            nextStepId: 'facility',
          },
        ],
      },
      {
        id: 'client_lookup_retry',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'ANSWER_VALID',
            nextStepId: 'client_lookup',
          },
        ],
      },
      {
        id: 'clientId',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'ANSWER_VALID',
            nextStepId: 'facility',
          },
        ],
      },
      {
        id: 'facility',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'ANSWER_VALID',
            nextStepId: 'appointment_type',
          },
        ],
      },
      {
        id: 'appointment_type',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'ANSWER_VALID',
            nextStepId: 'date',
          },
        ],
      },
      {
        id: 'date',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'CONVERSATION_COMPLETED',
            nextStepId: 'authenticate_before_submission',
          },
        ],
      },
      {
        id: 'authenticate_before_submission',
        type: 'ACTION',
        config: {
          action: 'HTTP_REQUEST',
          method: 'POST',
          url: '{{env.HS_BACKEND_BASE_URL}}/authentication',
          payload: {
            strategy: 'local',
            email: 'test@test.com',
            password: 'test',
          },
          saveResponseToState: {
            accessToken: '{{response.accessToken}}',
          },
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'submit_appointment',
          },
        ],
      },
      {
        id: 'submit_appointment',
        type: 'ACTION',
        config: {
          action: 'HTTP_REQUEST',
          method: 'POST',
          url: '{{env.HS_BACKEND_BASE_URL}}/appointments',
          headers: {
            Authorization: 'Bearer {{state.accessToken}}',
            'Content-Type': 'application/json',
          },
          mapping: {
            clientId: '{{state.clientId}}',
            facility: '{{state.facility}}',
            appointment_type: '{{state.appointment_type}}',
            date: '{{state.date}}',
          },
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'done',
          },
        ],
      },
      {
        id: 'done',
        type: 'END',
        transitions: [],
      },
    ],
  },
];

export async function seedWorkflows(
  app: INestApplicationContext,
): Promise<SeedResult> {
  const workflowModel = app.get<Model<Workflow>>(getModelToken(Workflow.name));
  const workflows = sampleWorkflows();

  let created = 0;
  let updated = 0;

  for (const workflow of workflows) {
    const existing = await workflowModel.findOne({ code: workflow.code }).lean();

    await workflowModel.replaceOne(
      { _id: workflow._id },
      workflow,
      { upsert: true },
    );

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return {
    created,
    updated,
    skipped: 0,
  };
}
