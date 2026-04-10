import { WorkflowEventType } from "../entities/step-transition";

export interface WorkflowEventPayload {
  [key: string]: any;
}

export interface WorkflowEventContext {
  workflowInstanceId: string;
  flowId?: string;
  conversationId?: string;
  stepId?: string;
  correlationId?: string;
  userId?: string;
  participant?: string;
  value?: string;
}

export interface IWorkflowEvent {
  id: string;
  type: WorkflowEventType | string;
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
