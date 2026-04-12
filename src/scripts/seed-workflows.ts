import { INestApplicationContext } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workflow } from '../modules/workflow/entities/workflow';
import { WorkflowEventType } from 'src/modules/workflow/entities/step-transition';
import { WorkflowStepType } from 'src/modules/workflow/entities/workflow-step';
import { ProcessingStrategy, ProcessMode, QuestionType, RenderMode } from 'src/shared/domain';

type SeedResult = {
  created: number;
  updated: number;
  skipped: number;
};

type SeedWorkflow = {
  _id: Types.ObjectId
  name: string;
  code: string;
  startStepId?: string;
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
  {
    _id: new Types.ObjectId('680000000000000000000010'),
    name: 'Appointment Booking Workflow',
    code: 'WF_APPOINTMENT_BOOKING',
    startStepId: 'appointment_type',

    metadata: {
      purpose: 'appointment-booking',
      description: 'Handles appointment booking with facility, location, client resolution and final creation.',
    },

    isActive: true,

    steps: [

      // 🔐 AUTHENTICATE
      {
        id: 'appointment_type',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'ANSWER_VALID',
            nextStepId: 'facilityId',
          },
        ],
      },
      {
        id: 'facilityId',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'ANSWER_VALID',
            nextStepId: 'authenticate',
          },
        ],
      },
      {
        id: 'authenticate',
        type: WorkflowStepType.ACTION,
        config: {
          action: 'HTTP_POST',
          url: '{{env.HS_BACKEND_BASE_URL}}/authentication',
          username: "{{env.HS_BACKEND_USERNAME}}",
          password: "{{env.HS_BACKEND_PASSWORD}}",
          accessTokenDuration: 3600000,
          requestBodyMapping: {
            strategy: {
              path: "",
              default: "local"
            },
            email: {
              "path": "username"
            },
            password: {
              path: "password"
            }
          }, 
          responseBodyMapping: {
            accessToken: {
              path: 'data.accessToken',
              validation: { required: true, type: 'string' },
            },
          },
        },
        transitions: [
          {
            event: WorkflowEventType.ACTION_COMPLETED,
            nextStepId: 'fetch_facilities',
          },
          {
            event: WorkflowEventType.ACTION_FAILED,
            nextStepId: 'fail',//TODO: use new step, unabble to find facilities
          },
        ],
      },
      // 🧠 WAIT
      {
        id: 'wait_for_answers',
        type: WorkflowStepType.WAIT,
        transitions: [
          {
            event: WorkflowEventType.ANSWER_VALID,
            nextStepId: 'router',
          },
        ],
      },

      // 🔀 ROUTER
      {
        id: 'router',
        type: WorkflowStepType.WAIT,
        config: {
        },
        transitions: [
          {
            event: '*',
            condition: "context.attribute === 'facilityId'",
            nextStepId: 'fetch_facilities',
          },
          {
            event: '*',
            condition: "context.attribute === 'locationId'",
            nextStepId: 'fetch_locations',
          },
          {
            event: '*',
            condition: "context.attribute === 'clientId'",
            nextStepId: 'fetch_clients',
          },
          {
            event: WorkflowEventType.ACTION_COMPLETED,
            condition: 'state.facilityId && state.locationId && state.clientId && state.appointment_type && state.start_time',
            nextStepId: 'await_completion',
          },
          {
            event: '*',
            condition: 'context.attribute == null',
            nextStepId: 'wait_for_answers',
          },
        ],
      },


      // 🏥 FETCH FACILITIES
      {
        id: 'fetch_facilities',
        type: WorkflowStepType.ACTION,
        config: {
          action: 'HTTP_GET',
          url: '{{env.HS_BACKEND_BASE_URL}}/facility',
          headersMapping: {
            Authorization: {
              path: 'authenticate.result.accessToken',
              transform: { prepend: 'Bearer ' },
            },
          },
          queryMapping: {
            'facilityName[$regex]': {
              path: 'facilityId',
            },
            'facilityName[$options]': {
              default: 'i',
            },
          },
          responseBodyMapping: {
            facilities: {
              path: 'data',
              validation: {
                type: 'array',
                required: true,
              },
            },
            total: {
              path: 'total',
              transform: 'number',
              default: 0,
            },
          },
        resultMapping: {
          flowId: { path: 'context.flowId' },
          options: {
            path: 'step.response.facilities',
            transform: 'map',
            map: {
              key: 'index',
              label: 'facilityName',
              value: '_id',
            },
          },
        }
      },
        transitions: [
          {
            event: WorkflowEventType.ACTION_COMPLETED,
            condition: 'fetch_facilities?.result?.options?.length > 0',
            nextStepId: 'emit_facility_options',
          },
          {
            event: '*',
            nextStepId: 'emit_no_facilities',//TODO: Emit try again
          },
        ],
      },

      // 📤 EMIT FACILITY OPTIONS
      {
        id: 'emit_facility_options',
        type: WorkflowStepType.ACTION,
        config: {
          action: 'WORKFLOW_ASK_OPTIONS',
          resultMapping: {
            flowId: { path: 'context.flowId' },
            question: {
              text: { default: 'Select a facility' },
              options: {
                path: 'fetch_facilities.result.options',
              },
            },
          },
        },
        transitions: [
          {
            event: WorkflowEventType.ACTION_COMPLETED,
            nextStepId: 'router',
          },
        ],
      },

      // 📤 EMIT LOCATION OPTIONS
      {
        id: 'emit_location_options',
        type: WorkflowStepType.ACTION,
        config: {
          action: 'WORKFLOW_ASK_OPTIONS',
          resultMapping: {
            flowId: { path: 'context.flowId' },
            question: {
              text: { default: 'Select a location' },
              options: {
                path: 'fetch_locations.result.options',
              },
            },
          },
        },
        transitions: [
          {
            event: WorkflowEventType.ACTION_COMPLETED,
            nextStepId: 'router',
          },
        ],
      },

      // 📤 EMIT CLIENT OPTIONS
      {
        id: 'emit_client_options',
        type: WorkflowStepType.ACTION,
        config: {
          action: 'WORKFLOW_ASK_OPTIONS',
          resultMapping: {
            flowId: { path: 'context.flowId' },
            question: {
              text: { default: 'Confirm Patient' },
              options: {
                path: 'fetch_clients.result.options',
              },
            },
          },
        },
        transitions: [
          {
            event: WorkflowEventType.ACTION_COMPLETED,
            nextStepId: 'router',
          },
        ],
      },

      // 📍 FETCH LOCATIONS
      {
        id: 'fetch_locations',
        type: WorkflowStepType.ACTION,
        config: {
          action: 'HTTP_GET',
          url: '{{env.HS_BACKEND_BASE_URL}}/location',
          queryMapping: {
            facility: { path: 'state.facilityId' },
            name: { path: 'payload.answer' },
          },
          responseBodyMapping: {
            locations: {
              path: 'data',
              validation: {
                type: 'array',
                required: true,
              },
            },
            total: {
              path: 'total',
              transform: 'number',
              default: 0,
            },
          },
          resultMapping: {
            flowId: { path: 'context.flowId' },
            options: {
              path: 'step.response.locations',
              transform: 'map',
              map: {
                key: 'index',
                label: 'name',
                value: '_id',
              },
            },
          },
        },
        transitions: [
          {
            event: WorkflowEventType.ACTION_COMPLETED,
            condition: 'fetch_locations.result.options.length > 0',
            nextStepId: 'emit_location_options',
          },
          {
            event: '*',
            nextStepId: 'emit_no_locations',
          },
        ],
      },

      // 👤 FETCH CLIENT
      {
        id: 'fetch_clients',
        type: WorkflowStepType.ACTION,
        config: {
          action: 'HTTP_GET',
          url: '{{env.HS_BACKEND_BASE_URL}}/client',
          queryMapping: {
            phone: { path: 'payload.answer' },
          },
          responseBodyMapping: {
            clients: {
              path: 'data',
              validation: {
                type: 'array',
                required: true,
              },
            },
            total: {
              path: 'total',
              transform: 'number',
              default: 0,
            },
          },
          resultMapping: {
            flowId: { path: 'context.flowId' },
            options: {
              path: 'step.response.clients',
              transform: 'map',
              map: {
                key: 'index',
                label: 'name',
                value: '_id',
              },
            },
          }
        },
        transitions: [
          {
            event: WorkflowEventType.ACTION_COMPLETED,
            condition: 'fetch_clients.result.options.length > 0',
            nextStepId: 'emit_client_options',
          },
          {
            event: '*',
            nextStepId: 'emit_no_client',
          },
        ],
      },
      {
        id: 'await_completion',
        type: WorkflowStepType.WAIT,
        transitions: [
          {
            event: WorkflowEventType.CONVERSATION_COMPLETED,
            nextStepId: 'create_appointment',
          },
        ],
      },

      // 📅 CREATE APPOINTMENT
      {
        id: 'create_appointment',
        type: WorkflowStepType.ACTION,
        config: {
          action: 'HTTP_POST',
          url: '{{env.HS_BACKEND_BASE_URL}}/appointments',
          requestBodyMapping: {
            facility: { path: 'state.facilityId' },
            locationId: { path: 'state.locationId' },
            clientId: { path: 'state.clientId' },
            appointment_type: { path: 'state.appointment_type' },
            date: { path: 'state.start_time' },
          },
        },
        transitions: [
          {
            event: WorkflowEventType.ACTION_COMPLETED,
            nextStepId: 'done',
          },
          {
            event: WorkflowEventType.ACTION_FAILED,
            nextStepId: 'fail',
          },
        ],
      },
      {
        id: 'emit_no_facilities',
        type: 'ACTION',
        config: {
          action: 'WORKFLOW_NO_OPTIONS_FOUND',
          resultMapping: {
            flowId: {
              path: 'context.flowId',
              validation: {
                required: true,
                type: 'string',
              },
            },
            message: {
              default: 'No facilities matched your answer. Please enter a different facility name.',
            },
          },
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'facilityId',
          },
        ],
      },

      {
        id: 'emit_no_locations',
        type: 'ACTION',
        config: {
          action: 'WORKFLOW_NO_OPTIONS_FOUND',
          resultMapping: {
            flowId: {
              path: 'context.flowId',
              validation: {
                required: true,
                type: 'string',
              },
            },
            message: {
              default: 'No locations matched your answer. Please enter a different location name.',
            },
          },
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'facilityId',
          },
        ],
      },

      {
        id: 'emit_no_client',
        type: 'ACTION',
        config: {
          action: 'WORKFLOW_NO_OPTIONS_FOUND',
          resultMapping: {
            flowId: {
              path: 'context.flowId',
              validation: {
                required: true,
                type: 'string',
              },
            },
            message: {
              default: 'No client matched your answer. Please enter a different client .',
            },
          },
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'facilityId',
          },
        ],
      },

      // ❌ FAIL SAFE
      {
        id: 'fail',
        type: WorkflowStepType.END,
        transitions: [],
      },

      // ✅ DONE
      {
        id: 'done',
        type: WorkflowStepType.END,
        transitions: [],
      },
    ],
  },
  {
    _id: new Types.ObjectId('680000000000000000000003'),
    name: 'Workflow-driven Facility Lookup Questionnaire',
    startStepId: 'customer_name',
    code: 'WF_DYNAMIC_FACILITY_LOOKUP',
    metadata: {
      purpose: 'workflow-dynamic-options',
      description:
        'Authenticates on conversation start, fetches facilities for workflow-processed answers, and emits option lists back to the conversation module.',
    },
    isActive: true,
    steps: [
      {
        id: 'customer_name',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'ANSWER_VALID',
            nextStepId: 'facilityId',
          },
        ],
      },
      {
        id: 'facilityId',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'ANSWER_VALID',
            nextStepId: 'authenticate_facility_lookup',
          },
        ],
      },
      {
        id: 'authenticate_facility_lookup',
        type: 'ACTION',
        config: {
          action: 'HTTP_POST',
          url: '{{env.HS_BACKEND_BASE_URL}}/authentication',
          payload: {
            strategy: 'local',
            email: '{{env.HS_BACKEND_USERNAME}}',
            password: '{{env.HS_BACKEND_PASSWORD}}',
          },
          responseBodyMapping: {
            accessToken: {
              path: 'data.accessToken',
              transform: 'string',
              validation: {
                required: true,
                type: 'string',
              },
            },
          },
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'fetch_facilities',
          },
          {
            event: 'ACTION_FAILED',
            nextStepId: 'emit_no_facilities',
          },
        ],
      },
      {
        id: 'fetch_facilities',
        type: 'ACTION',
        config: {
          action: 'HTTP_GET',
          url: '{{env.HS_BACKEND_BASE_URL}}/facility',
          headersMapping: {
            Authorization: {
              path: 'authenticate_facility_lookup.data.accessToken',
              transform: {
                prepend: 'Bearer ',
              },
            },
          },
          queryMapping: {
            'facilityName[$regex]': {
              path: 'facilityId',
            },
            'facilityName[$options]': {
              default: 'i',
            },
          },
          responseBodyMapping: {
            facilities: {
              path: 'data',
              validation: {
                type: 'array',
                required: true,
              },
            },
            total: {
              path: 'total',
              transform: 'number',
              default: 0,
            },
          },
          resultMapping: {
            flowId: { path: 'context.flowId' },
            options: {
              path: 'step.response.facilities',
              transform: 'map',
              map: {
                key: 'index',
                label: 'facilityName',
                value: '_id',
              },
            },
          },
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            condition: 'fetch_facilities.result?.options?.length > 0',
            nextStepId: 'emit_facility_options',
          },
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'emit_no_facilities',
          },
          {
            event: 'ACTION_FAILED',
            nextStepId: 'emit_no_facilities',
          },
        ],
      },
      {
        id: 'emit_facility_options',
        type: 'ACTION',
        config: {
          action: 'WORKFLOW_ASK_OPTIONS',
          resultMapping: {
            flowId: {
              path: 'context.flowId',
              validation: {
                required: true,
                type: 'string',
              },
            },
            question: {
              text: {
                default: 'Select the matching facility.',
              },
              options: {
                path: 'fetch_facilities.result.options',
              },
            },
            metadata: {},
          },
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'appointment_date',
          },
        ],
      },
      {
        id: 'emit_no_facilities',
        type: 'ACTION',
        config: {
          action: 'WORKFLOW_NO_OPTIONS_FOUND',
          resultMapping: {
            flowId: {
              path: 'context.flowId',
              validation: {
                required: true,
                type: 'string',
              },
            },
            message: {
              default: 'No facilities matched your answer. Please enter a different facility name.',
            },
          },
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'facilityId',
          },
        ],
      },
      {
        id: 'appointment_date',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'CONVERSATION_COMPLETED',
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
    _id: new Types.ObjectId('680000000000000000000004'),
    name: 'HTTP Post Authentication First Workflow',
    startStepId: 'confirm_values',
    code: 'WF_HTTP_POST_AUTH_FIRST',
    metadata: {
      purpose: 'http-post-auth',
      description:
        'Runs an authenticated HTTP_POST action before the first questionnaire step so the handler, response mapping, and runtime config can be tested.',
    },
    isActive: true,
    steps: [
      {
        id: 'confirm_values',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'CONVERSATION_STARTED',
            nextStepId: 'authenticate',
          },
        ],
      },
      {
        id: 'authenticate',
        type: 'ACTION',
        config: {
          action: "HTTP_POST",
          url: "{{env.HS_BACKEND_BASE_URL}}/authentication",
          username: "{{env.HS_BACKEND_USERNAME}}",
          password: "{{env.HS_BACKEND_PASSWORD}}",
          accessTokenDuration: 3600000,
          requestBodyMapping: {
            strategy: {
              path: "",
              default: "local"
            },
            email: {
              "path": "username"
            },
            password: {
              path: "password"
            }
          },
          responseBodyMapping: {
            "accessToken": {
              "path": "data.accessToken",
              "transform": "string",
              "default": null
            }
          },
          resultMapping: {
            "accessToken": {
              "path": "accessToken",
              "transform": "string",
              "default": null
            }
          }
        },
        transitions: [
          {
            event: 'ACTION_COMPLETED',
            nextStepId: 'reference_number',
          },
          {
            event: 'ACTION_FAILED',
            nextStepId: 'reference_number',
          },
        ],
      },
      {
        id: 'reference_number',
        type: 'QUESTIONNAIRE',
        transitions: [
          {
            event: 'CONVERSATION_COMPLETED',
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
