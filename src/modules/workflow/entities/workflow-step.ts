import { StepTransition } from "./step-transition";

export type WorkflowRetryStrategy = 'fixed' | 'linear' | 'exponential';

export type WorkflowDataMappingValidation = {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  enum?: any[];
  min?: number;
  max?: number;
  pattern?: string;
};

export type WorkflowDataMappingEntry =
  | string
  | {
      path: string;
      default?: any;
      transform?: 'number' | 'string' | 'boolean' | { prepend?: string; append?: string };
      validation?: WorkflowDataMappingValidation;
      map?: {
        key: string;
        label: string;
        value: string;
      };
      dependencies?: string[];
       [key: string]: any; // for nested objects
    };

export type WorkflowDataMapping = Record<string, WorkflowDataMappingEntry>;

export type WorkflowStepConfig = Record<string, any> & {
  timeoutMs?: number;
  retries?: number;
  retryStrategy?: WorkflowRetryStrategy;
  defaultValues?: Record<string, any>;
  
  requestBodyMapping?: WorkflowDataMapping;
  responseBodyMapping?: WorkflowDataMapping;
  queryMapping?: WorkflowDataMapping;
  resultMapping?: WorkflowDataMapping;
  headersMapping?: WorkflowDataMapping;

};

export type WorkflowStep = {
  id: string;
  type: WorkflowStepType;

  config?: WorkflowStepConfig;

  transitions: StepTransition[];

  onEnter?: StepExecution;
  onExit?: StepExecution;
};

export enum StepExecution {
  HTTP_POST,
  SERVICE_CALL,
  EMIT_EVENT,
  DELAY,
  NOOP
};

export enum WorkflowStepType {
  ACTION = 'ACTION',
  QUESTIONNAIRE = 'QUESTIONNAIRE',
  WAIT = 'WAIT',
  END = 'END',
}
