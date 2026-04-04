title Conversation Workflow Flow (Verbose)

participant User
participant ConversationService
participant ParticipantService
participant ConversationRepository
participant QuestionnaireService
participant QuestionProcessorService
participant ResponseService
participant ChannelSenderFactory
participant ChannelSender
participant ConversationWorkflowProcessor as WorkflowProcessorService
participant EventBusService
participant WorkflowEventSubscriber as WorkflowSubscriber
participant WorkflowRuntimeProcessor as WorkflowProcessorRuntime
participant WorkflowInstanceService
participant WorkflowService
participant HTTPAction as HTTP_POST

note over User,HTTPAction: This diagram covers the end-to-end flow used by workflow-backed conversations.\nIt includes conversation startup, answer handling, response persistence,\nworkflow event emission, workflow state transitions, and final action execution.

User->ConversationService: processInboundMessageFromPhoneNumber(channel, phone, message, questionnaireCode, context)
ConversationService->ParticipantService: findByPhone(phone)

alt Participant not found
  ParticipantService-->ConversationService: null
  ConversationService->ParticipantService: createParticipant({ phone })
  ParticipantService-->ConversationService: participant
else Participant found
  ParticipantService-->ConversationService: participant
end

ConversationService->ConversationService: processInboundMessage(channel, participant, message, questionnaireCode, context)
ConversationService->ConversationRepository: findActiveByParticipantId(participant.id)

alt No active conversation and questionnaire not found
  ConversationRepository-->ConversationService: null
  ConversationService->QuestionnaireService: findByCode(questionnaireCode)
  QuestionnaireService-->ConversationService: null
  ConversationService->QuestionnaireService: getInitQuestionnaires()
  QuestionnaireService-->ConversationService: questionnaires
  ConversationService->ChannelSenderFactory: getSender(channel.id)
  ChannelSenderFactory-->ConversationService: sender
  ConversationService->ChannelSender: sendMessage(participant, initMessage, false, context)
  ConversationService-->User: init/options message sent
end

alt No active conversation but questionnaire exists
  ConversationRepository-->ConversationService: null
  ConversationService->QuestionnaireService: findByCode(questionnaireCode)
  QuestionnaireService-->ConversationService: questionnaire
  ConversationService->QuestionnaireService: getStartQuestion(questionnaire)
  QuestionnaireService-->ConversationService: startQuestion

  ConversationService->ConversationRepository: create({ participantId, channelId, questionnaireId, currentQuestionId, questions })
  ConversationRepository-->ConversationService: conversation

  alt Questionnaire has workflowId
    ConversationService->ConversationWorkflowProcessor: createWorkFlow(workflowId, conversation.id, "conversation_started", startQuestion.attribute)
    ConversationWorkflowProcessor->WorkflowInstanceService: create({ workflowId, flowId: conversation.id, state: { trigger }, status: ACTIVE, currentStepId: startQuestion.attribute })
    WorkflowInstanceService-->ConversationWorkflowProcessor: workflowInstance
    ConversationWorkflowProcessor-->ConversationService: workflowInstance
    ConversationService->ConversationRepository: save(conversation.id, { workflowInstanceId })
    ConversationRepository-->ConversationService: conversation with workflowInstanceId
  end

  ConversationService->ChannelSenderFactory: getSender(conversation.channelId)
  ChannelSenderFactory-->ConversationService: sender
  ConversationService->ParticipantService: findOne(conversation.participantId)
  ParticipantService-->ConversationService: participant
  ConversationService->QuestionProcessorService: askQuestion(startQuestion)
  QuestionProcessorService-->ConversationService: renderedQuestion
  ConversationService->ChannelSender: sendMessage(participant, renderedQuestion, containsLink, metadata)
  ConversationService->ConversationRepository: save(conversation.id, { state: WAITING_FOR_USER })
  ConversationService->ResponseService: saveOutboundResponse(conversation.id, participant.id, startQuestion.id, startQuestion.attribute, renderedQuestion, valid=true)
  ConversationService->ConversationRepository: save(conversation.id, { state: WAITING_FOR_USER, currentQuestionId: startQuestion.id })

  alt Workflow instance exists
    ConversationService->ConversationWorkflowProcessor: conversationStarted(workflowInstanceId, participant.phone, incomingMessage)
    ConversationWorkflowProcessor->EventBusService: emit(CONVERSATION_STARTED, {}, { workflowInstanceId, value: incomingMessage, participant })
    EventBusService->WorkflowEventSubscriber: publish event
    WorkflowEventSubscriber->WorkflowRuntimeProcessor: handle event
    WorkflowRuntimeProcessor->WorkflowInstanceService: findById(workflowInstanceId)
    WorkflowInstanceService-->WorkflowRuntimeProcessor: instance
    WorkflowRuntimeProcessor->WorkflowService: findById(instance.workflowId)
    WorkflowService-->WorkflowRuntimeProcessor: workflow
    WorkflowRuntimeProcessor->WorkflowInstanceService: update(instance.id, { currentStepId, state })
  end

  ConversationService-->User: first question sent
end

alt Active conversation exists
  ConversationRepository-->ConversationService: active conversation
  ConversationService->QuestionnaireService: findOne(conversation.questionnaireId)
  QuestionnaireService-->ConversationService: questionnaire
  ConversationService->ConversationService: getCurrentQuestion(conversation)

  alt Message equals end phrase
    ConversationService->ConversationRepository: save(conversation.id, { status: STOPPED, endedAt })
    ConversationService->ChannelSenderFactory: getSender(conversation.channelId)
    ChannelSenderFactory-->ConversationService: sender
    ConversationService->ParticipantService: findOne(conversation.participantId)
    ParticipantService-->ConversationService: participant
    ConversationService->ChannelSender: sendMessage(participant, stopMessage, false, metadata)
    ConversationService->ResponseService: getValidResponsesMapByAttribute(conversation.id)
    ResponseService-->ConversationService: payload
    ConversationService->ConversationWorkflowProcessor: conversationStopped(workflowInstanceId, participant.phone, currentQuestion.attribute, message, payload)
    ConversationWorkflowProcessor->EventBusService: emit(CONVERSATION_STOPPED, payload, context)
    EventBusService->WorkflowEventSubscriber: publish event
    WorkflowEventSubscriber->WorkflowRuntimeProcessor: handle event
    WorkflowRuntimeProcessor->WorkflowInstanceService: findById(workflowInstanceId)
    WorkflowRuntimeProcessor->WorkflowService: findById(workflowId)
    WorkflowRuntimeProcessor->WorkflowInstanceService: update(status=STOPPED)
    ConversationService-->User: stop acknowledgement sent
  else Message is an answer
    ConversationService->QuestionProcessorService: processAnswer(conversation, currentQuestion, message)
    QuestionProcessorService-->ConversationService: processingResult
    ConversationService->ResponseService: saveInboundResponse(conversation.id, participant.id, currentQuestion.id, currentQuestion.attribute, message, valid)

    alt Validation error
      ConversationService->ChannelSenderFactory: getSender(conversation.channelId)
      ChannelSenderFactory-->ConversationService: sender
      ConversationService->ParticipantService: findOne(conversation.participantId)
      ParticipantService-->ConversationService: participant
      ConversationService->ChannelSender: sendMessage(participant, validationErrorMessage, containsLink, metadata)
      ConversationService->ResponseService: saveOutboundResponse(conversation.id, participant.id, currentQuestion.id, currentQuestion.attribute, validationErrorMessage, valid=false)
      ConversationService->ResponseService: getValidResponsesMapByAttribute(conversation.id)
      ResponseService-->ConversationService: payload
      ConversationService->ConversationWorkflowProcessor: answerInValid(workflowInstanceId, participant.phone, currentQuestion.attribute, processedValue, payload)
      ConversationWorkflowProcessor->EventBusService: emit(ANSWER_INVALID, payload, context)
      EventBusService->WorkflowEventSubscriber: publish event
      WorkflowEventSubscriber->WorkflowRuntimeProcessor: handle event
      WorkflowRuntimeProcessor->WorkflowInstanceService: findById(workflowInstanceId)
      WorkflowRuntimeProcessor->WorkflowService: findById(workflowId)
      WorkflowRuntimeProcessor-->ConversationService: no transition or remain on same step
      ConversationService-->User: validation feedback sent
    else Valid answer and another question exists
      ConversationService->ConversationRepository: save(conversation.id, { state: PROCESSING, currentQuestionId: nextQuestion.id })
      ConversationRepository-->ConversationService: updatedConversation
      ConversationService->ChannelSenderFactory: getSender(updatedConversation.channelId)
      ChannelSenderFactory-->ConversationService: sender
      ConversationService->ParticipantService: findOne(updatedConversation.participantId)
      ParticipantService-->ConversationService: participant
      ConversationService->QuestionProcessorService: askQuestion(nextQuestion)
      QuestionProcessorService-->ConversationService: renderedNextQuestion
      ConversationService->ChannelSender: sendMessage(participant, renderedNextQuestion, containsLink, metadata)
      ConversationService->ConversationRepository: save(updatedConversation.id, { state: WAITING_FOR_USER })
      ConversationService->ResponseService: saveOutboundResponse(updatedConversation.id, participant.id, nextQuestion.id, nextQuestion.attribute, renderedNextQuestion, valid=true)
      ConversationService->ResponseService: getValidResponsesMapByAttribute(updatedConversation.id)
      ResponseService-->ConversationService: payload
      ConversationService->ConversationWorkflowProcessor: answerValid(workflowInstanceId, participant.phone, currentQuestion.attribute, processedAnswer, payload)
      ConversationWorkflowProcessor->EventBusService: emit(ANSWER_VALID, payload, context)
      EventBusService->WorkflowEventSubscriber: publish event
      WorkflowEventSubscriber->WorkflowRuntimeProcessor: handle event
      WorkflowRuntimeProcessor->WorkflowInstanceService: findById(workflowInstanceId)
      WorkflowInstanceService-->WorkflowRuntimeProcessor: instance
      WorkflowRuntimeProcessor->WorkflowService: findById(instance.workflowId)
      WorkflowService-->WorkflowRuntimeProcessor: workflow
      WorkflowRuntimeProcessor->WorkflowInstanceService: update(instance.id, { currentStepId: transition.nextStepId, state: mergedPayload })
      ConversationService-->User: next question sent
    else Valid answer completes questionnaire
      ConversationService->ConversationRepository: save(conversation.id, { status: COMPLETED, state: COMPLETED, endedAt })
      ConversationService->QuestionnaireService: findOne(conversation.questionnaireId)
      QuestionnaireService-->ConversationService: questionnaire
      ConversationService->ChannelSenderFactory: getSender(conversation.channelId)
      ChannelSenderFactory-->ConversationService: sender
      ConversationService->ParticipantService: findOne(conversation.participantId)
      ParticipantService-->ConversationService: participant
      ConversationService->ChannelSender: sendMessage(participant, questionnaire.conclusion, false, metadata)
      ConversationService->ResponseService: saveOutboundResponse(conversation.id, participant.id, currentQuestion.id, currentQuestion.attribute, questionnaire.conclusion, valid=true)
      ConversationService->ResponseService: getValidResponsesMapByAttribute(conversation.id)
      ResponseService-->ConversationService: payload
      ConversationService->ConversationWorkflowProcessor: conversationCompleted(workflowInstanceId, participant.phone, currentQuestion.attribute, processedAnswer, payload)
      ConversationWorkflowProcessor->EventBusService: emit(CONVERSATION_COMPLETED, payload, { workflowInstanceId, stepId: currentQuestion.attribute, value: processedAnswer, participant })
      EventBusService->WorkflowEventSubscriber: publish event
      WorkflowEventSubscriber->WorkflowRuntimeProcessor: handle event
      WorkflowRuntimeProcessor->WorkflowInstanceService: findById(workflowInstanceId)
      WorkflowInstanceService-->WorkflowRuntimeProcessor: instance
      WorkflowRuntimeProcessor->WorkflowService: findById(instance.workflowId)
      WorkflowService-->WorkflowRuntimeProcessor: workflow
      WorkflowRuntimeProcessor->WorkflowInstanceService: update(instance.id, { currentStepId: transition.nextStepId, state: mergedPayload })

      alt Next workflow step is ACTION with HTTP_POST
        WorkflowRuntimeProcessor->HTTPAction: axios.post(url, mappedPayload or merged state)
        HTTPAction-->WorkflowRuntimeProcessor: success
        WorkflowRuntimeProcessor->WorkflowRuntimeProcessor: processEvent(ACTION_COMPLETED)
        WorkflowRuntimeProcessor->WorkflowInstanceService: findById(workflowInstanceId)
        WorkflowRuntimeProcessor->WorkflowService: findById(workflowId)
        WorkflowRuntimeProcessor->WorkflowInstanceService: update(instance.id, { currentStepId: done, state })
        WorkflowRuntimeProcessor->WorkflowInstanceService: update(instance.id, { status: COMPLETED })
      else Next workflow step is END
        WorkflowRuntimeProcessor->WorkflowInstanceService: update(instance.id, { status: COMPLETED })
      else Next workflow step waits for another event
        WorkflowRuntimeProcessor-->WorkflowEventSubscriber: no immediate side effect
      end

      ConversationService-->User: completion acknowledgement sent
    end
  end
end
