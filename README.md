# Conversation Engine

`conversation-engine` is a NestJS service for running questionnaire-driven conversations across channels, persisting inbound and outbound responses, and advancing workflow instances based on conversation events.

At a high level, the project does four things:

- Receives inbound user messages from a channel such as SMS or WhatsApp.
- Resolves the participant and active conversation state.
- Validates and stores answers against questionnaire questions.
- Emits workflow events that can transition the workflow and execute actions such as `HTTP_POST`.

## What The Project Contains

The codebase is organized around four main domains:

- `conversation`: conversation lifecycle, participant lookup, answer processing, response persistence.
- `questionnaire`: questionnaire definitions, questions, option lists, and question processing.
- `channels`: channel abstractions, senders, processors, webhook endpoints, exchange logging.
- `workflow`: workflow definitions, workflow instances, event bus, transitions, subscribers, and step/action execution.

Supporting folders:

- `src/shared`: shared domain types, enums, and converters.
- `src/scripts`: questionnaire seeding and startup sync utilities.
- `test`: focused e2e tests for conversation, questionnaire, and workflow paths.

## Runtime Overview

The application boots from [src/main.ts](/Users/john/develop/healthstack/conversation-engine/src/main.ts) and wires [src/app.module.ts](/Users/john/develop/healthstack/conversation-engine/src/app.module.ts).

Important startup behavior:

- Loads configuration via `ConfigModule`.
- Connects to MongoDB via `MongooseModule.forRootAsync`.
- Applies a collection prefix using `DB_PREFIX`.
- Exposes Swagger at `/api/docs`.
- Writes `swagger.json` into the project root on startup.
- Seeds questionnaires on boot unless `SEED_ON_STARTUP=false`.

## Main Modules

### Conversation Module

Key responsibilities:

- create and load active conversations
- route inbound messages into questionnaire processing
- send the next prompt or completion message
- persist inbound and outbound responses
- emit workflow events when the conversation changes state

Key files:

- [src/modules/conversation/services/conversation.service.ts](/Users/john/develop/healthstack/conversation-engine/src/modules/conversation/services/conversation.service.ts)
- [src/modules/conversation/services/ResponseService.ts](/Users/john/develop/healthstack/conversation-engine/src/modules/conversation/services/ResponseService.ts)
- [src/modules/conversation/processors/workflow-processor.service.ts](/Users/john/develop/healthstack/conversation-engine/src/modules/conversation/processors/workflow-processor.service.ts)
- [src/modules/conversation/repositories/mongo/conversation.repository.ts](/Users/john/develop/healthstack/conversation-engine/src/modules/conversation/repositories/mongo/conversation.repository.ts)

### Questionnaire Module

Key responsibilities:

- resolve questionnaires by code or id
- determine the start question
- validate and process answers
- provide the conversation with the next question or completion state

### Channels Module

Key responsibilities:

- abstract channel senders and processors
- provide webhook/controller entry points
- log exchanges
- bridge inbound messages to the conversation module

Notable file:

- [src/channels/services/exchange.service.ts](/Users/john/develop/healthstack/conversation-engine/src/channels/services/exchange.service.ts)

### Workflow Module

Key responsibilities:

- store workflow definitions and workflow instances
- emit and subscribe to workflow events
- evaluate transitions
- execute workflow steps, including action steps like `HTTP_POST`

Key files:

- [src/modules/workflow/services/event-bus.service.ts](/Users/john/develop/healthstack/conversation-engine/src/modules/workflow/services/event-bus.service.ts)
- [src/modules/workflow/processors/workflow-processor.ts](/Users/john/develop/healthstack/conversation-engine/src/modules/workflow/processors/workflow-processor.ts)
- [src/modules/workflow/services/workflow-instance.ts](/Users/john/develop/healthstack/conversation-engine/src/modules/workflow/services/workflow-instance.ts)
- [src/modules/workflow/services/workflow-service.ts](/Users/john/develop/healthstack/conversation-engine/src/modules/workflow/services/workflow-service.ts)
- [src/modules/workflow/subscribers/subscriber.ts](/Users/john/develop/healthstack/conversation-engine/src/modules/workflow/subscribers/subscriber.ts)

## End-To-End Flow

This is the full flow that connects the main services together.

### 1. An inbound message arrives

The entry point is usually:

- `ConversationService.processInboundMessageFromPhoneNumber(...)`

That method:

- looks up the participant by phone
- creates the participant if needed
- delegates to `processInboundMessage(...)`

### 2. The conversation is resolved

`ConversationService.processInboundMessage(...)`:

- checks for an active conversation
- if none exists, resolves the questionnaire by code
- creates a new conversation if a questionnaire exists
- sends an init message if neither a conversation nor questionnaire is found

### 3. A workflow instance may be created

When a questionnaire has a `workflowId`:

- the conversation service calls `WorkflowProcessorService.createWorkFlow(...)`
- a workflow instance is created in the workflow module
- the workflow instance id is saved onto the conversation
- `conversationStarted(...)` emits `CONVERSATION_STARTED`

### 4. Questions are sent

The conversation service:

- resolves a channel sender from `ChannelSenderFactory`
- renders the question
- sends the outbound message
- stores the outbound response via `ResponseService.saveOutboundResponse(...)`

### 5. Answers are processed and stored

When the user replies:

- the current question is loaded from the conversation
- `QuestionProcessorService.processAnswer(...)` validates and interprets the answer
- the inbound response is saved via `ResponseService.saveInboundResponse(...)`

If invalid:

- the validation message is sent back
- `ANSWER_INVALID` is emitted

If valid and more questions remain:

- the conversation advances to the next question
- the next question is sent
- `ANSWER_VALID` is emitted

If valid and the questionnaire is complete:

- the conversation is marked `COMPLETED`
- the conclusion message is sent
- `CONVERSATION_COMPLETED` is emitted

### 6. Response payload aggregation

`ResponseService.getValidResponsesMapByAttribute(...)` builds a payload from valid inbound answers for a conversation. For example:

```ts
{
  patient_number: 'PN-001',
  patient_dob: '2022-10-12'
}
```

That payload is what the workflow event side uses for transitions and final action execution.

### 7. Workflow events are emitted

The conversation-side workflow facade in [src/modules/conversation/processors/workflow-processor.service.ts](/Users/john/develop/healthstack/conversation-engine/src/modules/conversation/processors/workflow-processor.service.ts) emits:

- `CONVERSATION_STARTED`
- `ANSWER_VALID`
- `ANSWER_INVALID`
- `CONVERSATION_COMPLETED`
- `CONVERSATION_STOPPED`

Each event goes through `EventBusService.emit(type, payload, context)`.

The context usually includes:

- `workflowInstanceId`
- `stepId`
- `participant`
- `value`

### 8. Workflow transitions are evaluated

The workflow runtime processor in [src/modules/workflow/processors/workflow-processor.ts](/Users/john/develop/healthstack/conversation-engine/src/modules/workflow/processors/workflow-processor.ts):

- loads the workflow instance
- loads the workflow definition
- finds the current step
- merges the incoming payload into workflow state
- finds the transition matching the event
- updates the workflow instance to the next step
- executes the next step if needed

### 9. Actions can be executed

If the next workflow step is an `ACTION`:

- the processor reads its config
- it optionally maps the aggregated payload
- it executes the action

For `HTTP_POST`, the workflow runtime calls `axios.post(url, payload)`.

After action success:

- `ACTION_COMPLETED` is processed
- the workflow transitions again
- if it reaches `END`, the instance is marked `COMPLETED`

## What Was Recently Clarified In This Repo

The workflow/conversation path now relies on these important behaviors:

- workflow events are emitted through `EventBusService`, which keeps tests and event subscribers aligned
- workflow definitions and workflow instances are loaded with explicit `ObjectId`-based lookups
- the conversation stores `workflowInstanceId` in a shape Mongo and Mongoose handle consistently
- exchange change-stream startup errors are handled gracefully in non-replica-set test environments
- update queries on the exercised path use `returnDocument: 'after'` instead of deprecated `new: true`

## Tests

The main focused e2e tests are:

- [test/modules/conversation/conversation.e2e-spec.ts](/Users/john/develop/healthstack/conversation-engine/test/modules/conversation/conversation.e2e-spec.ts)
- [test/modules/conversation/workflow-submission.e2e-spec.ts](/Users/john/develop/healthstack/conversation-engine/test/modules/conversation/workflow-submission.e2e-spec.ts)
- [test/modules/questionnaire/questionnaire.e2e-spec.ts](/Users/john/develop/healthstack/conversation-engine/test/modules/questionnaire/questionnaire.e2e-spec.ts)
- [test/modules/workflow/workflow-processing.e2e-spec.ts](/Users/john/develop/healthstack/conversation-engine/test/modules/workflow/workflow-processing.e2e-spec.ts)

What the workflow-specific tests prove:

- `workflow-submission.e2e-spec.ts`
  Ensures a workflow-backed conversation emits `CONVERSATION_COMPLETED` with the aggregated submission payload.

- `workflow-processing.e2e-spec.ts`
  Ensures a workflow transitions correctly, maps the final payload, executes `HTTP_POST`, and completes the workflow instance.

Useful commands:

```bash
npm install
npm run start:dev
npm run test:e2e
npx jest --config ./test/jest-e2e.json --runInBand test/modules/conversation/workflow-submission.e2e-spec.ts
npx jest --config ./test/jest-e2e.json --runInBand test/modules/workflow/workflow-processing.e2e-spec.ts
```

## Configuration Notes

From the current codebase, the main runtime settings are:

- `MONGODB_URI`: Mongo connection string
- `MONGODB_NAME`: database name override
- `DB_PREFIX`: collection name prefix, defaults to `dev`
- `PORT`: server port, defaults to `8080`
- `SEED_ON_STARTUP`: when not set to `false`, questionnaire seeding runs at boot

## Sequence Diagrams

Two sequence diagrams were added in `sequencediagram.org` format:

- [sequencediagram.compact.md](/Users/john/develop/healthstack/conversation-engine/sequencediagram.compact.md)
- [sequencediagram.md](/Users/john/develop/healthstack/conversation-engine/sequencediagram.md)

The compact diagram is a quick overview. The verbose diagram is meant for onboarding and tracing the complete cross-module flow.

### Compact Diagram

```text
title Conversation Workflow Flow (Compact)

participant User
participant ConversationService
participant ParticipantService
participant ConversationRepository
participant QuestionnaireService
participant QuestionProcessorService
participant ResponseService
participant ChannelSenderFactory
participant WorkflowProcessorService as ConversationWorkflowProcessor
participant EventBusService
participant WorkflowProcessorRuntime
participant WorkflowInstanceService
participant WorkflowService
participant HTTPAction as HTTP_POST

User->ConversationService: processInboundMessageFromPhoneNumber(phone, message, questionnaireCode, context)
ConversationService->ParticipantService: findByPhone(phone)
ParticipantService-->ConversationService: participant
ConversationService->ConversationRepository: findActiveByParticipantId(participant.id)

alt No active conversation
  ConversationService->QuestionnaireService: findByCode(questionnaireCode)
  QuestionnaireService-->ConversationService: questionnaire
  ConversationService->QuestionnaireService: getStartQuestion(questionnaire)
  ConversationService->ConversationRepository: create(conversation)
  ConversationService->ConversationWorkflowProcessor: createWorkFlow(workflowId, conversationId, trigger, startAttribute)
  ConversationWorkflowProcessor->WorkflowInstanceService: create(instance)
  WorkflowInstanceService-->ConversationWorkflowProcessor: workflowInstance
  ConversationWorkflowProcessor-->ConversationService: workflowInstance
  ConversationService->ConversationRepository: save(workflowInstanceId)
  ConversationService->ChannelSenderFactory: getSender(channelId)
  ChannelSenderFactory-->ConversationService: sender
  ConversationService->ResponseService: saveOutboundResponse(...)
  ConversationService->ConversationRepository: save(state=WAITING_FOR_USER)
  ConversationService->ConversationWorkflowProcessor: conversationStarted(workflowInstanceId, participant.phone, message)
  ConversationWorkflowProcessor->EventBusService: emit(CONVERSATION_STARTED, payload, context)
else Active conversation exists
  ConversationService->QuestionProcessorService: processAnswer(conversation, currentQuestion, message)
  QuestionProcessorService-->ConversationService: processingResult
  ConversationService->ResponseService: saveInboundResponse(...)

  alt Validation error
    ConversationService->ChannelSenderFactory: getSender(channelId)
    ConversationService->ResponseService: saveOutboundResponse(...)
    ConversationService->ConversationWorkflowProcessor: answerInValid(workflowInstanceId, participant.phone, attribute, value, payload)
    ConversationWorkflowProcessor->EventBusService: emit(ANSWER_INVALID, payload, context)
  else Answer valid and next question exists
    ConversationService->ConversationRepository: save(currentQuestionId=nextQuestion.id)
    ConversationService->ChannelSenderFactory: getSender(channelId)
    ConversationService->ResponseService: saveOutboundResponse(...)
    ConversationService->ConversationWorkflowProcessor: answerValid(workflowInstanceId, participant.phone, attribute, value, payload)
    ConversationWorkflowProcessor->EventBusService: emit(ANSWER_VALID, payload, context)
  else Questionnaire completed
    ConversationService->ConversationRepository: save(status=COMPLETED, state=COMPLETED)
    ConversationService->ChannelSenderFactory: getSender(channelId)
    ConversationService->ResponseService: saveOutboundResponse(...)
    ConversationService->ConversationWorkflowProcessor: conversationCompleted(workflowInstanceId, participant.phone, attribute, value, payload)
    ConversationWorkflowProcessor->EventBusService: emit(CONVERSATION_COMPLETED, payload, context)
  end
end

EventBusService->WorkflowProcessorRuntime: deliver event
WorkflowProcessorRuntime->WorkflowInstanceService: findById(workflowInstanceId)
WorkflowInstanceService-->WorkflowProcessorRuntime: instance
WorkflowProcessorRuntime->WorkflowService: findById(instance.workflowId)
WorkflowService-->WorkflowProcessorRuntime: workflow
WorkflowProcessorRuntime->WorkflowInstanceService: update(currentStepId, state)

alt Next step is ACTION/HTTP_POST
  WorkflowProcessorRuntime->HTTP_POST: axios.post(url, mappedPayload)
  WorkflowProcessorRuntime->WorkflowProcessorRuntime: processEvent(ACTION_COMPLETED)
  WorkflowProcessorRuntime->WorkflowInstanceService: update(currentStepId=done)
else Next step is END
  WorkflowProcessorRuntime->WorkflowInstanceService: update(status=COMPLETED)
else Next step waits for another questionnaire event
  WorkflowProcessorRuntime-->EventBusService: no action, wait for next event
end
```

### Verbose Diagram

The full version is intentionally kept in its own file:

- [sequencediagram.md](/Users/john/develop/healthstack/conversation-engine/sequencediagram.md)

## Development Notes

When editing this project, the most important paths to keep consistent are:

- conversation state in the conversation repository
- saved inbound responses in `ResponseService`
- emitted workflow events and their payload/context
- workflow instance transitions and step execution

If one of those gets out of sync, workflow-backed conversations usually fail in one of three visible ways:

- the conversation completes but no workflow event is emitted
- the workflow event is emitted but no transition happens
- the workflow transitions but the final action receives the wrong payload
