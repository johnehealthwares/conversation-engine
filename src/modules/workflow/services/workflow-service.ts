// services/workflow.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workflow, WorkflowDocument } from '../entities/workflow';
import { WorkflowDomain } from 'src/shared/domain';
import { toDomain } from 'src/shared/converters';

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

  async findAll(): Promise<Workflow[]> {
    return this.workflowModel.find().exec();
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
