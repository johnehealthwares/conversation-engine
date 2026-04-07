import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkflowService } from '../services/workflow-service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/workflow.dto';
import { FilterWorkflowDto } from './dto/filter-workflow.dto';

@ApiTags('Workflows')
@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workflow definition' })
  create(@Body() dto: CreateWorkflowDto) {
    return this.workflowService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workflow definitions' })
  findAll(@Query() filter: FilterWorkflowDto) {
    return this.workflowService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow definition by id' })
  findOne(@Param('id') id: string) {
    return this.workflowService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace a workflow definition' })
  replace(@Param('id') id: string, @Body() dto: UpdateWorkflowDto) {
    return this.workflowService.replace(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Patch a workflow definition' })
  patch(@Param('id') id: string, @Body() dto: UpdateWorkflowDto) {
    return this.workflowService.patch(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow definition' })
  remove(@Param('id') id: string) {
    return this.workflowService.remove(id);
  }
}
