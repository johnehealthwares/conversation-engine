// services/workflow-event.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowEvent, WorkflowEventDocument } from '../entities/event';

@Injectable()
export class WorkflowEventService {
  constructor(
    @InjectModel(WorkflowEvent.name) private eventModel: Model<WorkflowEventDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  async emit(workflowInstanceId: string, type: string, payload?: Record<string, any>) {
    // save event to DB
    const event = new this.eventModel({ workflowInstanceId, type, payload });
    await event.save();

    // emit event on EventBus
    this.eventEmitter.emit(type, { workflowInstanceId, payload });
    return event;
  }

  async findAll(): Promise<WorkflowEvent[]> {
    return this.eventModel.find().sort({ createdAt: -1 }).exec();
  }

  async findUnprocessed(): Promise<WorkflowEvent[]> {
    return this.eventModel.find({ processed: false }).exec();
  }

  async markProcessed(id: string, processed = true) {
    const event = await this.eventModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { processed },
      { returnDocument: 'after' },
    );
    if (!event) {
      throw new NotFoundException('Workflow event not found');
    }

    return event;
  }
}
