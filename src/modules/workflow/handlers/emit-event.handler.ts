import { WorkflowEventType } from '../entities/step-transition';
import { WorkflowStepConfig } from '../entities/workflow-step';
import { ActionResult } from './http-post.handler';

function inferEventType(config: WorkflowStepConfig): WorkflowEventType | undefined {
  const configuredEvent = config.eventType || config.nextEvent;
  if (configuredEvent) {
    return configuredEvent as WorkflowEventType;
  }

  const actionName = String(config.action || '');
  if (actionName in WorkflowEventType) {
    return WorkflowEventType[actionName as keyof typeof WorkflowEventType];
  }

  if (Object.values(WorkflowEventType).includes(actionName as WorkflowEventType)) {
    return actionName as WorkflowEventType;
  }

  return undefined;
}

export async function handleEmitEvent(
  config: WorkflowStepConfig,
  state: Record<string, any>,
): Promise<ActionResult> {
  const nextEvent = inferEventType(config);

  if (!nextEvent) {
    return {
      success: false,
      error: `Unable to resolve event type for action "${config.action}"`,
    };
  }

  return {
    success: true,
    data: state,
    nextEvent,
  };
}
