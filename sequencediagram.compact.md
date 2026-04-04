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
