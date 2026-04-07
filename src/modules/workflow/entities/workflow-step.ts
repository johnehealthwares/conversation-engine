import { StepTransition } from "./step-transition";

export type WorkflowRetryStrategy = 'fixed' | 'linear' | 'exponential';

export type WorkflowResponseMappingValidation = {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  enum?: any[];
  min?: number;
  max?: number;
  pattern?: string;
};

export type WorkflowResponseMappingEntry =
  | string
  | {
      path: string;
      default?: any;
      transform?: 'number' | 'string' | 'boolean';
      validation?: WorkflowResponseMappingValidation;
      dependencies?: string[];
    };

export type WorkflowStepConfig = Record<string, any> & {
  timeoutMs?: number;
  retries?: number;
  retryStrategy?: WorkflowRetryStrategy;
  defaultValues?: Record<string, any>;
  responseMapping?: Record<string, WorkflowResponseMappingEntry>;
};

export type WorkflowStep = {
  id: string;
  type: 'START' | 'QUESTIONNAIRE' | 'ACTION' | 'WAIT' | 'END';

  config?: WorkflowStepConfig;

  transitions: StepTransition[];
};
