// services/workflow-instance.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkflowInstance, WorkflowInstanceDocument } from '../entities/instance';
import { toDomain } from 'src/shared/converters';
import { WorkflowInstanceDomain } from 'src/shared/domain';
import { FilterWorkflowInstanceDto } from '../controllers/dto/filter-workflow-instance.dto';
import { WorkflowService } from './workflow-service';

@Injectable()
export class WorkflowInstanceService {
  constructor(
    @InjectModel(WorkflowInstance.name) private instanceModel: Model<WorkflowInstanceDocument>,
    private readonly workflowService: WorkflowService,
  ) {}

  async create(data: Partial<WorkflowInstance>): Promise<WorkflowInstanceDomain> {
    const workflow = await this.workflowService.findById(data.workflowId!);
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    const instance = new this.instanceModel({
      _id: new Types.ObjectId(),
      workflowVersion: data.workflowVersion ?? workflow.version,
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

  async getActiveByConversationId(conversationId: string): Promise<WorkflowInstanceDomain | null> {
    const instance = await this.instanceModel
      .findOne({ flowId: conversationId, status: 'ACTIVE' })
      .lean();
    if(instance)
    return toDomain(instance);
  return null;
  }

  async update(id: string, data: Partial<WorkflowInstance>): Promise<WorkflowInstanceDomain> {
    return this.patch(id, data);
  }

  async replace(id: string, data: Partial<WorkflowInstance>): Promise<WorkflowInstanceDomain> {
    const instance = await this.instanceModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      data,
      { returnDocument: 'after' },
    );
    if (!instance) throw new NotFoundException('Workflow instance not found');
    return toDomain(instance);
  }

  async patch(id: string, data: Partial<WorkflowInstance>): Promise<WorkflowInstanceDomain> {
    const payload = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
    const instance = await this.instanceModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      payload,
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
