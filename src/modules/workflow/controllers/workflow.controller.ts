import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkflowService } from '../services/workflow-service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/workflow.dto';

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
  findAll() {
    return this.workflowService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow definition by id' })
  findOne(@Param('id') id: string) {
    return this.workflowService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workflow definition' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkflowDto) {
    return this.workflowService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow definition' })
  remove(@Param('id') id: string) {
    return this.workflowService.remove(id);
  }
}

