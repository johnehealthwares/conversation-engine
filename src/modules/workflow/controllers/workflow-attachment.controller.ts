import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateWorkflowAttachmentDto,
  UpdateWorkflowAttachmentDto,
  ValidateWorkflowAttachmentDto,
} from './dto/workflow-attachment.dto';
import { WorkflowAttachmentService } from '../services/workflow-attachment.service';

@ApiTags('Workflow Attachments')
@Controller('workflow-attachments')
export class WorkflowAttachmentController {
  constructor(
    private readonly workflowAttachmentService: WorkflowAttachmentService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Save workflow attachment draft' })
  createDraft(@Body() dto: CreateWorkflowAttachmentDto) {
    return this.workflowAttachmentService.createDraft(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workflow attachments' })
  findAll() {
    return this.workflowAttachmentService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow attachment draft' })
  findOne(@Param('id') id: string) {
    return this.workflowAttachmentService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workflow attachment draft' })
  patch(@Param('id') id: string, @Body() dto: UpdateWorkflowAttachmentDto) {
    return this.workflowAttachmentService.patch(id, dto);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate workflow attachment payload' })
  validatePayload(@Body() dto: ValidateWorkflowAttachmentDto) {
    return this.workflowAttachmentService.validateDraftPayload(dto);
  }

  @Post(':id/validate')
  @ApiOperation({ summary: 'Validate saved workflow attachment draft' })
  validate(@Param('id') id: string) {
    return this.workflowAttachmentService.validate(id);
  }

  @Post(':id/attach')
  @ApiOperation({ summary: 'Attach workflow to questionnaire from draft' })
  attach(@Param('id') id: string) {
    return this.workflowAttachmentService.attach(id);
  }
}
