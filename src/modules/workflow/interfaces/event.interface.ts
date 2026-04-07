import { WorkflowEventType } from "../entities/step-transition";

export interface WorkflowEventPayload {
  [key: string]: any;
}

export interface WorkflowEventContext {
  workflowId?: string;
  workflowInstanceId?: string;
  flowId?: string;
  stepId?: string;
  correlationId?: string;
  userId?: string;
  participant?: string;
  value?: string;
}

export interface IWorkflowEvent {
  id: string;
  type: WorkflowEventType;
  payload: WorkflowEventPayload;
  context: WorkflowEventContext;
  meta: {
    timestamp: string;
    source?: string;
    sequence?: number;
    idempotencyKey?: string;
    stateSchema?: Record<string, any> | null;
  };
}
