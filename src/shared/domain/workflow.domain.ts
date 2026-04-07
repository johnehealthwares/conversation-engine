import { WorkflowStep } from 'src/modules/workflow/entities/workflow-step';

export interface Workflow {
  id: string;
  name: string;
  code: string;
  metadata?: Record<string, any>;
  steps: WorkflowStep[];
  version: number;
  maxTransitionsPerRun: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
