import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkflowInstanceService } from '../services/workflow-instance';
import {
  CreateWorkflowInstanceDto,
  UpdateWorkflowInstanceDto,
} from './dto/workflow-instance.dto';
import { FilterWorkflowInstanceDto } from './dto/filter-workflow-instance.dto';

@ApiTags('Workflow Instances')
@Controller('workflow-instances')
export class WorkflowInstanceController {
  constructor(
    private readonly workflowInstanceService: WorkflowInstanceService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a workflow instance' })
  create(@Body() dto: CreateWorkflowInstanceDto) {
    return this.workflowInstanceService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workflow instances' })
  findAll(@Query() filter: FilterWorkflowInstanceDto) {
    return this.workflowInstanceService.findAll(filter);
  }

  @Get('by-flow/:flowId/active')
  @ApiOperation({ summary: 'Get the active workflow instance for a conversation/flow id' })
  findActiveByConversationId(@Param('flowId') flowId: string) {
    return this.workflowInstanceService.getActiveByConversationId(flowId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow instance by id' })
  findOne(@Param('id') id: string) {
    return this.workflowInstanceService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workflow instance' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkflowInstanceDto) {
    return this.workflowInstanceService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow instance' })
  remove(@Param('id') id: string) {
    return this.workflowInstanceService.remove(id);
  }
}
