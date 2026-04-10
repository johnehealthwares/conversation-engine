import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventTransport } from './event-transport';

@Injectable()
export class InMemoryEventTransportService implements EventTransport {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit(eventName: string, payload: unknown): Promise<unknown[]> {
    return this.eventEmitter.emitAsync(eventName, payload);
  }
}
