import { WorkflowEventType } from "../entities/step-transition";

export interface WorkflowEventState {
  [key: string]: any;
}

export interface WorkflowEventContext {
  workflowInstanceId: string;
  flowId?: string;
  stepId?: string;
  correlationId?: string;
  userId?: string;
  participant?: string;
  attribute?: string;
  value?: string;
}

export interface IWorkflowEvent {
  id: string;
  type: WorkflowEventType | string;
  state: WorkflowEventState;
  context: WorkflowEventContext;
  meta: {
    timestamp: string;
    source?: string;
    sequence?: number;
    idempotencyKey?: string;
    stateSchema?: Record<string, any> | null;
  };
}
