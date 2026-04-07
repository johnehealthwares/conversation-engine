import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IWorkflowEvent } from '../interfaces/event.interface';
import { randomUUID } from 'crypto';
import { WorkflowEventType } from '../entities/step-transition';

@Injectable()
export class EventBusService {
  constructor(private eventEmitter: EventEmitter2) {}

  emit(
    type: WorkflowEventType,
    payload: Record<string, any>,
    context: any = {},
    meta: Partial<IWorkflowEvent['meta']> = {},
  ) {
    const event: IWorkflowEvent = {
      id: randomUUID(),
      type,
      payload,
      context,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    };

    this.eventEmitter.emit(type, event);
    return event;
  }
}
