import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { IWorkflowEvent, WorkflowEventContext, WorkflowEventPayload } from 'src/modules/workflow/interfaces/event.interface';
import { WorkflowEventType } from 'src/modules/workflow/entities/step-transition';
import { EVENT_TRANSPORT } from './event-transport';
import type { EventTransport } from './event-transport';

@Injectable()
export class EventBusService {
  constructor(
    @Inject(EVENT_TRANSPORT)
    private readonly transport: EventTransport,
  ) {}

  async emit(
    type: WorkflowEventType | string,
    payload: WorkflowEventPayload,
    context: Partial<WorkflowEventContext> = {},
    meta: Partial<IWorkflowEvent['meta']> = {},
  ) {
    const event: IWorkflowEvent = {
      id: randomUUID(),
      type,
      payload,
      context: context as WorkflowEventContext,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    };

    await this.transport.emit(type, event);
    return event;
  }
}
