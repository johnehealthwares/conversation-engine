export type WorkflowStatus = 'ACTIVE' | 'COMPLETED' | 'STOPPED';

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflowVersion: number;
  flowId: string;
  state: Record<string, any>;
  config?: Record<string, any>;
  status: WorkflowStatus;
  currentStepId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
