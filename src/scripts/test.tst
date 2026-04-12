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
            event: 'WORKFLOW_ANSWER_RECEIVED',
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
          requestBodyMapping: {
            strategy: { default: 'local' },
            email: { path: 'env.HS_BACKEND_USERNAME' },
            password: { path: 'env.HS_BACKEND_PASSWORD' },
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
            event: WorkflowEventType.WORKFLOW_ANSWER_RECEIVED,
            nextStepId: 'router',
          },
        ],
      },

      // 🔀 ROUTER
      {
        id: 'router',
        type: WorkflowStepType.ACTION,
        config: {
          action: 'NOOP',
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
            condition: 'context.facilityId && context.locationId && context.clientId && context.appointment_type && context.start_time'
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
              path: 'authenticate.data.accessToken',
              transform: { prepend: 'Bearer ' },
            },
          },
          queryMapping: {
            'facilityName[$regex]': {
              path: 'payload.answer',
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
        },
        resultMapping: {
            conversationId: { path: 'context.conversationId' },
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
            conversationId: { path: 'context.conversationId' },
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
            conversationId: { path: 'context.conversationId' },
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
            conversationId: { path: 'context.conversationId' },
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
        },
        resultMapping: {
            conversationId: { path: 'context.conversationId' },
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
            conversationId: { path: 'context.conversationId' },
            options: {
              path: 'step.response.clients',
              transform: 'map',
              map: {
                key: 'index',
                label: 'name',
                value: '_id',
              },
            },
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
            conversationId: {
              path: 'context.conversationId',
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
            conversationId: {
              path: 'context.conversationId',
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
            conversationId: {
              path: 'context.conversationId',
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