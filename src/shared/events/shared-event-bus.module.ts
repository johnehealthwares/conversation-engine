import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBusService } from './event-bus.service';
import { EVENT_TRANSPORT } from './event-transport';
import { InMemoryEventTransportService } from './in-memory-event-transport.service';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
    EventBusService,
    InMemoryEventTransportService,
    {
      provide: EVENT_TRANSPORT,
      useExisting: InMemoryEventTransportService,
    },
  ],
  exports: [EventBusService],
})
export class SharedEventBusModule {}
