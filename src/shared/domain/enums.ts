export enum QuestionType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
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
  DROPDOWN = 'dropdown',
  CHAT = 'chat',
  FILE_UPLOAD = 'file_upload',
}

export enum ProcessMode {
  NONE = 'none',
  OPTION_PROCESSED = 'option_processed',
  AI_PROCESSED = 'ai_processed',
  RULE_ENGINE = 'rule_engine',
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
}

export enum ChannelType {
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
