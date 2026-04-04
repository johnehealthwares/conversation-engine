import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkflowEventService } from '../services/workflow-event-service';
import {
  EmitWorkflowEventDto,
  MarkWorkflowEventProcessedDto,
} from './dto/workflow-event.dto';
import { FilterWorkflowEventDto } from './dto/filter-workflow-event.dto';

@ApiTags('Workflow Events')
@Controller('workflow-events')
export class WorkflowEventController {
  constructor(private readonly workflowEventService: WorkflowEventService) {}

  @Post()
  @ApiOperation({ summary: 'Emit and persist a workflow event' })
  emit(@Body() dto: EmitWorkflowEventDto) {
    return this.workflowEventService.emit(
      dto.workflowInstanceId,
      dto.type,
      dto.payload,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List workflow events' })
  findAll(@Query() filter: FilterWorkflowEventDto) {
    return this.workflowEventService.findAll(filter);
  }

  @Get('unprocessed')
  @ApiOperation({ summary: 'List unprocessed workflow events' })
  findUnprocessed() {
    return this.workflowEventService.findUnprocessed();
  }

  @Patch(':id/processed')
  @ApiOperation({ summary: 'Mark a workflow event as processed' })
  markProcessed(
    @Param('id') id: string,
    @Body() dto: MarkWorkflowEventProcessedDto,
  ) {
    return this.workflowEventService.markProcessed(id, dto.processed);
  }
}
