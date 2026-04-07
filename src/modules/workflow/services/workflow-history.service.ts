import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WorkflowHistory,
  WorkflowHistoryDocument,
} from '../entities/workflow-history';

@Injectable()
export class WorkflowHistoryService {
  constructor(
    @InjectModel(WorkflowHistory.name)
    private readonly historyModel: Model<WorkflowHistoryDocument>,
  ) {}

  async record(workflowInstanceId: string, stepId: string | undefined, event: string) {
    return this.historyModel.create({
      _id: new Types.ObjectId(),
      workflowInstanceId,
      stepId,
      event,
      timestamp: new Date(),
    });
  }
}
