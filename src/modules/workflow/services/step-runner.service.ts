import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkflowService } from './workflow-service';
import { WorkflowInstanceService } from './workflow-instance';
import { EventBusService } from './event-bus.service';
import { ActionLog } from '../entities/action-log';
import { createActionHandlers } from '../handlers';
import type { ActionResult } from '../handlers/http-post.handler';
import type { IWorkflowEvent } from '../interfaces/event.interface';
import { WorkflowHistoryService } from './workflow-history.service';
import { WorkflowResponseMappingValidation, WorkflowStep } from '../entities/workflow-step';
import { WorkflowEventType } from '../entities/step-transition';

@Injectable()
export class StepRunnerService {
  private logger = new Logger(StepRunnerService.name);
  private readonly actionHandlers = createActionHandlers();

  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowInstanceService: WorkflowInstanceService,
    private readonly eventBusService: EventBusService,
    @InjectModel(ActionLog.name)
    private readonly actionLogRepository: Model<ActionLog>,
    private readonly workflowHistoryService: WorkflowHistoryService,
  ) {}

  async runStep(
    workflowId: string,
    stepId: string,
    workflowInstanceId: string,
    triggerEvent?: IWorkflowEvent,
  ) {
    this.logger.log(`Running step ${stepId} for workflow ${workflowId}`);

    const workflow = await this.workflowService.findById(workflowId);
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    const workflowInstance = await this.workflowInstanceService.findById(workflowInstanceId);
    const step = workflow.steps.find((item) => item.id === stepId);

    if (!step) {
      throw new NotFoundException(`Workflow step not found: ${stepId}`);
    }

    const state = workflowInstance.state || {};
    const config = workflowInstance.config || {};

    if (step.type === 'END') {
      await this.workflowHistoryService.record(
        workflowInstance.id,
        step.id,
        'WORKFLOW_COMPLETED',
      );
      await this.workflowInstanceService.update(workflowInstance.id, {
        status: 'COMPLETED',
      });
      return;
    }

    if (step.type !== 'ACTION') {
      await this.workflowHistoryService.record(
        workflowInstance.id,
        step.id,
        `STEP_ENTERED:${step.type}`,
      );
      return;
    }

    await this.executeAction(
      step,
      workflowInstance.id,
      state,
      config,
      workflowId,
      triggerEvent,
    );
  }

  private getHandler(action: string) {
    const handler = this.actionHandlers[action as keyof typeof this.actionHandlers];
    if (!handler) {
      throw new NotFoundException(`Action handler not found: ${action}`);
    }
    return handler;
  }

  private getValueByPath(obj: any, path: string) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  private resolveTemplate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, rawPath) => {
      const value = rawPath
        .trim()
        .split('.')
        .reduce((acc, key) => acc?.[key], context);
      return value === undefined || value === null ? '' : String(value);
    });
  }

  private resolveConfigValue(value: any, state: Record<string, any>): any {
    if (typeof value === 'string') {
      return value.includes('{{')
        ? this.resolveTemplate(value, { state, ...state, env: process.env })
        : value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolveConfigValue(item, state));
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).reduce((acc, [key, item]) => {
        acc[key] = this.resolveConfigValue(item, state);
        return acc;
      }, {} as Record<string, any>);
    }

    return value;
  }

  private extractMappedFields(mapping: Record<string, any>, source: any) {
    const result: Record<string, any> = {};

    for (const key in mapping) {
      const map = mapping[key];

      if (typeof map === 'object' && map) {
        let value = this.getValueByPath(source, map.path);
        if (value === undefined && typeof map.path === 'string' && map.path.startsWith('data.')) {
          value = this.getValueByPath(source, map.path.replace(/^data\./, ''));
        }

        if (value === undefined) {
          value = map.default ?? null;
        }

        if (map.transform === 'number') value = Number(value);
        if (map.transform === 'string' && value != null) value = String(value);
        if (map.transform === 'boolean') value = Boolean(value);
        this.validateMappedValue(key, value, map.validation);

        result[key] = value;
      } else if (typeof map === 'string') {
        result[key] = this.getValueByPath(source, map);
      }
    }

    return result;
  }

  private validateMappedValue(
    field: string,
    value: any,
    validation?: WorkflowResponseMappingValidation,
  ) {
    if (!validation) {
      return;
    }

    if (validation.required && (value === undefined || value === null || value === '')) {
      throw new Error(`Response mapping "${field}" is required`);
    }

    if (
      validation.type &&
      value != null &&
      !this.matchesType(value, validation.type)
    ) {
      throw new Error(
        `Response mapping "${field}" must be of type ${validation.type}`,
      );
    }

    if (validation.enum?.length && value != null && !validation.enum.includes(value)) {
      throw new Error(`Response mapping "${field}" must match one of the allowed values`);
    }

    if (typeof value === 'number' && validation.min != null && value < validation.min) {
      throw new Error(`Response mapping "${field}" must be >= ${validation.min}`);
    }

    if (typeof value === 'number' && validation.max != null && value > validation.max) {
      throw new Error(`Response mapping "${field}" must be <= ${validation.max}`);
    }

    if (
      validation.pattern &&
      typeof value === 'string' &&
      !new RegExp(validation.pattern).test(value)
    ) {
      throw new Error(`Response mapping "${field}" does not match the expected pattern`);
    }
  }

  private matchesType(value: any, type: NonNullable<WorkflowResponseMappingValidation['type']>) {
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return value != null && typeof value === 'object' && !Array.isArray(value);
    return typeof value === type;
  }

  private async persistActionResult(
    instanceId: string,
    stepId: string,
    result: ActionResult,
    triggerEvent: IWorkflowEvent | undefined,
    input: Record<string, any>,
    durationMs: number,
  ) {
    await this.actionLogRepository.create({
      workflowInstanceId: instanceId,
      stepId,
      eventId: triggerEvent?.id,
      correlationId: triggerEvent?.context?.correlationId,
      success: result.success,
      durationMs,
      input,
      output: result.data,
      error: result.error,
      metadata: result.metadata,
      executedAt: new Date(),
    });
  }

  private classifyError(result: ActionResult) {
    const status = Number(result.metadata?.status);
    const errorMessage = (result.error ?? '').toLowerCase();
    const retryable =
      !status ||
      status >= 500 ||
      status === 408 ||
      status === 429 ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('temporarily');

    return {
      retryable,
      errorType: retryable ? 'RETRYABLE' : 'FATAL',
    } as const;
  }

  private getRetryDelayMs(
    attempt: number,
    strategy: string,
    baseDelayMs = 250,
  ) {
    switch (strategy) {
      case 'exponential':
        return baseDelayMs * 2 ** (attempt - 1);
      case 'linear':
        return baseDelayMs * attempt;
      case 'fixed':
      default:
        return baseDelayMs;
    }
  }

  private async wait(delayMs: number) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs?: number) {
    if (!timeoutMs || timeoutMs <= 0) {
      return promise;
    }

    return Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`Action timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  }

  private async executeActionWithRetry(
    handler: (config: Record<string, any>, state: Record<string, any>) => Promise<ActionResult>,
    resolvedConfig: Record<string, any>,
    state: Record<string, any>,
  ) {
    const retries = Math.max(0, Number(resolvedConfig.retries ?? 0));
    const retryStrategy = String(resolvedConfig.retryStrategy ?? 'fixed');
    const timeoutMs =
      Number.isFinite(Number(resolvedConfig.timeoutMs)) && Number(resolvedConfig.timeoutMs) > 0
        ? Number(resolvedConfig.timeoutMs)
        : undefined;

    let lastResult: ActionResult | null = null;

    for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
      try {
        const currentResult = await this.withTimeout(
          handler(resolvedConfig, state),
          timeoutMs,
        );
        const classification = this.classifyError(currentResult);
        lastResult = {
          ...currentResult,
          metadata: {
            ...(currentResult.metadata ?? {}),
            attempts: attempt,
            retryable: classification.retryable,
            errorType: classification.errorType,
          },
        };

        if (currentResult.success || !classification.retryable || attempt > retries) {
          return lastResult;
        }
      } catch (error: any) {
        const errorResult: ActionResult = {
          success: false,
          error: error?.message ?? 'Unknown action error',
          metadata: {
            attempts: attempt,
          },
        };
        const classification = this.classifyError(errorResult);
        lastResult = {
          ...errorResult,
          metadata: {
            ...(errorResult.metadata ?? {}),
            retryable: classification.retryable,
            errorType: classification.errorType,
          },
        };

        if (!classification.retryable || attempt > retries) {
          return lastResult;
        }
      }

      await this.wait(this.getRetryDelayMs(attempt, retryStrategy));
    }

    return (
      lastResult ?? {
        success: false,
        error: 'Action failed without result',
        metadata: {
          retryable: false,
          errorType: 'FATAL',
          attempts: retries + 1,
        },
      }
    );
  }

  private async executeAction(
    step: WorkflowStep,
    instanceId: string,
    state: Record<string, any>,
    workflowConfig: Record<string, any>,
    workflowId: string,
    triggerEvent?: IWorkflowEvent,
  ) {
    const mergedConfig = {
      ...workflowConfig,
      ...(step.config || {}),
    };
    const resolvedConfig = this.resolveConfigValue(mergedConfig, state);
    const handler = this.getHandler(resolvedConfig.action);
    const startedAt = Date.now();
    const result = await this.executeActionWithRetry(handler, resolvedConfig, state);
    const durationMs = Date.now() - startedAt;

    let extracted = {};

    if (step.config?.responseMapping) {
      extracted = this.extractMappedFields(step.config.responseMapping, result.data);
    } else if (result.data) {
      extracted = result.data;
    }

    const defaultValues = step.config?.defaultValues ?? {};

    await this.persistActionResult(
      instanceId,
      step.id,
      result,
      triggerEvent,
      resolvedConfig,
      durationMs,
    );

    const updatedState = {
      ...state,
      ...defaultValues,
      ...extracted,
      lastAction: {
        stepId: step.id,
        success: result.success,
        errorType: result.metadata?.errorType,
        attempts: result.metadata?.attempts,
      },
    };

    await this.workflowInstanceService.update(instanceId, {
      state: updatedState,
      config: result.updatedConfig ?? resolvedConfig,
    });

    await this.workflowHistoryService.record(
      instanceId,
      step.id,
      result.success ? WorkflowEventType.ACTION_COMPLETED : WorkflowEventType.ACTION_FAILED,
    );

    const eventType =
      result.nextEvent ||
      (result.success ? WorkflowEventType.ACTION_COMPLETED : WorkflowEventType.ACTION_FAILED);

    this.eventBusService.emit(
      eventType,
      extracted || {},
      {
        workflowInstanceId: instanceId,
        workflowId,
        stepId: step.id,
        correlationId: triggerEvent?.context?.correlationId,
      },
      {
        source: 'step-runner',
      },
    );
  }
}
