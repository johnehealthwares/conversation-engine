// services/workflow-event.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkflowEvent, WorkflowEventDocument } from '../entities/event';
import { FilterWorkflowEventDto } from '../controllers/dto/filter-workflow-event.dto';
import { WorkflowEventType } from '../entities/step-transition';
import { EventBusService } from 'src/shared/events';

@Injectable()
export class WorkflowEventService {
  constructor(
    @InjectModel(WorkflowEvent.name) private eventModel: Model<WorkflowEventDocument>,
    private readonly eventBusService: EventBusService,
  ) {}

  async emit(input: {
    workflowInstanceId: string;
    type: WorkflowEventType;
    payload?: Record<string, any>;
    workflowId?: string;
    stepId?: string;
    correlationId?: string;
    idempotencyKey?: string;
    stateSchema?: Record<string, any>;
    sequence?: number;
  }) {
    if (input.idempotencyKey) {
      const existing = await this.eventModel
        .findOne({ idempotencyKey: input.idempotencyKey })
        .exec();
      if (existing) {
        return existing;
      }
    }

    const event = new this.eventModel({
      workflowInstanceId: input.workflowInstanceId,
      workflowId: input.workflowId,
      stepId: input.stepId,
      type: input.type,
      payload: input.payload,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      stateSchema: input.stateSchema,
      sequence: input.sequence,
    });
    await event.save();

    await this.eventBusService.emit(
      input.type,
      input.payload ?? {},
      {
        workflowInstanceId: input.workflowInstanceId,
        correlationId: input.correlationId,
      },
      {
        timestamp: event.createdAt?.toISOString() ?? new Date().toISOString(),
        source: 'workflow-event-service',
        idempotencyKey: input.idempotencyKey,
        sequence: input.sequence,
        stateSchema: input.stateSchema ?? null,
      },
    );
    return event;
  }

  async findAll(filter: FilterWorkflowEventDto = {}): Promise<WorkflowEvent[]> {
    const query: Record<string, any> = {};
    if (filter.workflowInstanceId) query.workflowInstanceId = filter.workflowInstanceId;
    if (filter.type) query.type = filter.type;
    if (typeof filter.processed === 'boolean') query.processed = filter.processed;
    if (filter.search?.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      query.$or = [{ workflowInstanceId: regex }, { type: regex }];
    }

    return this.eventModel.find(query).sort({ createdAt: -1 }).exec();
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
