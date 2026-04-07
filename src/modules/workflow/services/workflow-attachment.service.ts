import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { QuestionService } from 'src/modules/questionnaire/services/question.service';
import { QuestionnaireService } from 'src/modules/questionnaire/services/questionnaire.service';
import { WorkflowAttachment, WorkflowAttachmentDocument } from '../entities/workflow-attachment';
import { WorkflowAttachmentValidationService } from './workflow-attachment-validation.service';
import { WorkflowService } from './workflow-service';

type AttachmentPayload = {
  questionnaireId: string;
  workflowId: string;
  workflowVersion?: number;
  mappings: Array<{
    questionId?: string;
    questionAttribute: string;
    workflowStepId?: string;
  }>;
  metadata?: Record<string, any>;
};

@Injectable()
export class WorkflowAttachmentService {
  constructor(
    @InjectModel(WorkflowAttachment.name)
    private readonly attachmentModel: Model<WorkflowAttachmentDocument>,
    private readonly workflowService: WorkflowService,
    private readonly questionnaireService: QuestionnaireService,
    private readonly questionService: QuestionService,
    private readonly validationService: WorkflowAttachmentValidationService,
  ) {}

  async createDraft(payload: AttachmentPayload) {
    const workflow = await this.workflowService.findById(payload.workflowId);
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    const attachment = await this.attachmentModel.create({
      _id: new Types.ObjectId(),
      ...payload,
      workflowVersion: payload.workflowVersion ?? workflow.version,
      status: 'DRAFT',
    });

    return attachment.toObject();
  }

  async findAll() {
    return this.attachmentModel.find().sort({ updatedAt: -1 }).lean();
  }

  async findOne(id: string) {
    const attachment = await this.attachmentModel
      .findById(new Types.ObjectId(id))
      .lean();
    if (!attachment) {
      throw new NotFoundException('Workflow attachment not found');
    }
    return attachment;
  }

  async patch(id: string, payload: Partial<AttachmentPayload>) {
    const attachment = await this.attachmentModel
      .findByIdAndUpdate(
        new Types.ObjectId(id),
        {
          $set: Object.fromEntries(
            Object.entries(payload).filter(([, value]) => value !== undefined),
          ),
        },
        { new: true },
      )
      .lean();

    if (!attachment) {
      throw new NotFoundException('Workflow attachment not found');
    }

    return attachment;
  }

  async validateDraftPayload(payload: AttachmentPayload) {
    const workflow = await this.workflowService.findById(payload.workflowId);
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    const questionnaire = await this.questionnaireService.findOne(
      payload.questionnaireId,
    );
    const questions = await this.questionService.findAll({
      questionnaireId: payload.questionnaireId,
    });

    return this.validationService.validate({
      workflow,
      questionnaire,
      questions,
      mappings: payload.mappings,
    });
  }

  async validate(id: string) {
    const attachment = await this.findOne(id);
    const result = await this.validateDraftPayload(attachment);
    const status = result.valid ? 'VALIDATED' : 'INVALID';

    await this.attachmentModel.findByIdAndUpdate(new Types.ObjectId(id), {
      $set: {
        validationSummary: result,
        status,
      },
    });

    return result;
  }

  async attach(id: string) {
    const attachment = await this.findOne(id);
    const validationResult = await this.validate(id);

    if (!validationResult.valid) {
      return validationResult;
    }

    const questionnaire = await this.questionnaireService.findOne(
      attachment.questionnaireId,
    );
    const attachmentRef = attachment._id?.toString?.() ?? id;

    await this.questionnaireService.patch(questionnaire.id, {
      workflowId: attachment.workflowId,
      processingStrategy: 'WORKFLOW' as any,
      metadata: {
        ...(questionnaire.metadata ?? {}),
        workflowAttachmentId: attachmentRef,
        workflowVersion: attachment.workflowVersion,
      },
    });

    await this.attachmentModel.findByIdAndUpdate(new Types.ObjectId(id), {
      $set: {
        status: 'ATTACHED',
      },
    });

    return {
      attached: true,
      attachmentId: attachmentRef,
      validation: validationResult,
    };
  }
}
