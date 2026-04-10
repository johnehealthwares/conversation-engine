export enum QuestionType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  EMAIL = 'email',
  OBJECT_ID = 'object_id',
  UUID = 'uuid',
  SINGLE_CHOICE = 'single_choice',
  MULTI_CHOICE = 'multi_choice',
  BOOLEAN = 'boolean',
  FILE = 'file',
  AI_OPEN = 'ai_open',
}

export enum RenderMode {
  INPUT = 'input',
  TEXTAREA = 'textarea',
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  YES_NO = 'yes_no',
  STAR_RATING = 'star_rating',
  TEXT_WITH_LINK = 'TEXT_WITH_LINK',
  LINK = 'LINK',
  DROPDOWN = 'dropdown',
  CHAT = 'chat',
  FILE_UPLOAD = 'file_upload',
}

export enum ProcessMode {
  NONE = 'none',
  OPTION_PROCESSED = 'option_processed',
  API_PROCESSED = 'api_processed',
  AI_PROCESSED = 'ai_processed',
  QUESTION_TYPE = 'question_type',
  RULE_ENGINE = 'rule_engine',
  WORKFLOW_PROCESSED = 'workflow_processed',
}

export enum ProcessingStrategy {
  STATIC = 'STATIC',
  AI_ASSISTED = 'AI_ASSISTED',
  FULL_AI = 'FULL_AI',
}

export enum ResponseDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum ConversationState {
  START = 'START',
  PROCESSING = 'PROCESSING',
  WAITING_FOR_DELIVERY = 'WAITING_FOR_DELIVERY',
  WAITING_FOR_USER = 'WAITING_FOR_USER',
  COMPLETED = 'COMPLETED',
  INCOMPLETE = 'INCOMPLETE',
  ERROR = 'ERROR'
}

export enum ChannelType {
  MOCK = 'MOCK',
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  WEBCHAT = 'WEBCHAT',
  TELEGRAM = 'TELEGRAM',
  API = 'API',
}

export enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  STOPPED = 'STOPPED',
  CANCELLED = 'CANCELLED',
}


export enum ConversationReponseAction {
  CREATED_NEW_CONVERSATION = "CREATED_NEW_CONVERSATION",
  CONVERSATION_NOT_FOUND = "CONVERSATION_NOT_FOUND",
  INVALID_ANSWER = "INVALID_ANSWER",
  REPLIED_CONVERSATION = "REPLIED_CONVERSATION",
  SENT_INIT_MESSAGE = "SENT_INIT_MESSAGE",
  STOPPED_CONVERSATION = "STOPPED_CONVERSATION",
  COMPLETED_CONVERSATION = "COMPLETED_CONVERSATION",
  PROCESSING_WORKFLOW_ANSWER = "PROCESSING_WORKFLOW_ANSWER",
  WORKFLOW_COMPLETED = "WORKFLOW_COMPLETED"
}