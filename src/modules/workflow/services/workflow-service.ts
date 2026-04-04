// services/workflow.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workflow, WorkflowDocument } from '../entities/workflow';
import { WorkflowDomain } from 'src/shared/domain';
import { toDomain } from 'src/shared/converters';
import { FilterWorkflowDto } from '../controllers/dto/filter-workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(
    @InjectModel(Workflow.name) private workflowModel: Model<WorkflowDocument>,
  ) {}

  async create(data: Partial<Workflow>): Promise<WorkflowDomain> {
    const workflow = new this.workflowModel(data);
    return workflow.save();
  }

  async findById(id: string): Promise<WorkflowDomain | null> {
    const wf = await this.workflowModel
      .findOne({ _id: new Types.ObjectId(id) })
      .lean();
    return toDomain(wf);
  }

  async findByCode(code: string): Promise<Workflow> {
    const wf = await this.workflowModel.findOne({ code }).exec();
    if (!wf) throw new NotFoundException('Workflow not found');
    return wf;
  }

  async findAll(filter: FilterWorkflowDto = {}): Promise<Workflow[]> {
    const query: Record<string, any> = {};

    if (filter.code) query.code = filter.code;
    if (filter.name) query.name = new RegExp(filter.name, 'i');
    if (typeof filter.isActive === 'boolean') query.isActive = filter.isActive;
    if (filter.search?.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      query.$or = [{ name: regex }, { code: regex }];
    }

    return this.workflowModel.find(query).exec();
  }

  async update(id: string, data: Partial<Workflow>): Promise<Workflow> {
    const wf = await this.workflowModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      data,
      { returnDocument: 'after' },
    );
    if (!wf) throw new NotFoundException('Workflow not found');
    return wf;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.workflowModel.deleteOne({
      _id: new Types.ObjectId(id),
    });
    if (!result.deletedCount) {
      throw new NotFoundException('Workflow not found');
    }

    return { deleted: true };
  }
}
