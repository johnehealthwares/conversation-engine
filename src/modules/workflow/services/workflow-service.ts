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
    const workflow = new this.workflowModel({
      version: 1,
      maxTransitionsPerRun: 25,
      ...data,
    });
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

  async findAll(filter: FilterWorkflowDto = {}): Promise<WorkflowDomain[]> {
    const query: Record<string, any> = {};

    if (filter.code) query.code = filter.code;
    if (filter.name) query.name = new RegExp(filter.name, 'i');
    if (typeof filter.isActive === 'boolean') query.isActive = filter.isActive;
    if (filter.search?.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      query.$or = [{ name: regex }, { code: regex }];
    }
    const schemas = await this.workflowModel.find(query).exec();
    console.log({schemas})
    return schemas.map(toDomain);
  }

  async update(id: string, data: Partial<Workflow>): Promise<WorkflowDomain> {
    const schema =this.patch(id, data);
    return  toDomain(schema);
  }

  async replace(id: string, data: Partial<Workflow>): Promise<WorkflowDomain> {
    const wf = await this.workflowModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      data,
      { returnDocument: 'after' },
    );
    if (!wf) throw new NotFoundException('Workflow not found');
    return wf;
  }

  async patch(id: string, data: Partial<Workflow>): Promise<Workflow> {
    const payload = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
    const wf = await this.workflowModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      payload,
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
