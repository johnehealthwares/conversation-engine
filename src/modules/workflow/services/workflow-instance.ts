// services/workflow-instance.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkflowInstance, WorkflowInstanceDocument } from '../entities/instance';
import { toDomain } from 'src/shared/converters';
import { WorkflowInstanceDomain } from 'src/shared/domain';
import { FilterWorkflowInstanceDto } from '../controllers/dto/filter-workflow-instance.dto';

@Injectable()
export class WorkflowInstanceService {
  constructor(
    @InjectModel(WorkflowInstance.name) private instanceModel: Model<WorkflowInstanceDocument>,
  ) {}

  async create(data: Partial<WorkflowInstance>): Promise<WorkflowInstanceDomain> {
    const instance = new this.instanceModel({
      _id: new Types.ObjectId(),
      ...data,
    });
    return toDomain(await instance.save());
  }

  async findAll(filter: FilterWorkflowInstanceDto = {}): Promise<WorkflowInstanceDomain[]> {
    const query: Record<string, any> = {};
    if (filter.flowId) query.flowId = filter.flowId;
    if (filter.workflowId) query.workflowId = filter.workflowId;
    if (filter.status) query.status = filter.status;
    if (filter.search?.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { workflowId: regex },
        { flowId: regex },
        { currentStepId: regex },
        { status: regex },
      ];
    }

    const instances = await this.instanceModel.find(query).lean();
    return toDomain(instances);
  }

  async findById(id: string): Promise<WorkflowInstanceDomain> {
    const instance = await this.instanceModel
      .findOne({ _id: new Types.ObjectId(id) })
      .lean();
    if (!instance) throw new NotFoundException('Workflow instance not found');
    return toDomain(instance);
  }

  async getActiveByConversationId(conversationId: string): Promise<WorkflowInstanceDomain> {
    const instance = await this.instanceModel
      .findOne({ flowId: conversationId, status: 'ACTIVE' })
      .lean();
    if (!instance) throw new NotFoundException('Workflow instance not found for conversation');
    return toDomain(instance);
  }

  async update(id: string, data: Partial<WorkflowInstance>): Promise<WorkflowInstanceDomain> {
    const instance = await this.instanceModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      data,
      { returnDocument: 'after' },
    );
    if (!instance) throw new NotFoundException('Workflow instance not found');
    return toDomain(instance);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.instanceModel.deleteOne({
      _id: new Types.ObjectId(id),
    });
    if (!result.deletedCount) {
      throw new NotFoundException('Workflow instance not found');
    }

    return { deleted: true };
  }
}
