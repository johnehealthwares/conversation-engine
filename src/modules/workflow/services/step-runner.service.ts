import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkflowInstanceService } from './workflow-instance';
import { EventBusService } from 'src/shared/events';
import { ActionLog } from '../entities/action-log';
import { createActionHandlers } from '../handlers';
import type { ActionResult } from '../handlers/http-post.handler';
import type { IWorkflowEvent } from '../interfaces/event.interface';
import { WorkflowHistoryService } from './workflow-history.service';
import { WorkflowDataMappingValidation, WorkflowStep } from '../entities/workflow-step';
import { WorkflowEventType } from '../entities/step-transition';
import { WorkflowInstance } from 'src/shared/domain/workflow-instance.domain';

@Injectable()
export class StepRunnerService {
  private logger = new Logger(StepRunnerService.name);
  private readonly actionHandlers = createActionHandlers();

  constructor(
    private readonly eventBusService: EventBusService,
    @InjectModel(ActionLog.name)
    private readonly actionLogRepository: Model<ActionLog>,
    private readonly workflowInstanceService: WorkflowInstanceService,
    private readonly workflowHistoryService: WorkflowHistoryService,
  ) { }

  private buildActionContext(
    state: Record<string, any>,
    triggerEvent: IWorkflowEvent,
  ): Record<string, any> {
    return {
      ...state,
      state,
      payload: {
        ...(triggerEvent.state || {}),
        answer: triggerEvent.context?.value,
        attribute: triggerEvent.context?.attribute,
        participant: triggerEvent.context?.participant,
      },
      context: triggerEvent.context || {},
      event: triggerEvent,
    };
  }

  async runStep(
    triggerEvent: IWorkflowEvent,
    step: WorkflowStep,
    workflowInstance: WorkflowInstance,
  ) {
    this.logger.log(
      `Running step ${step.id} (type=${step.type}) for instance ${workflowInstance.id}`,
    );

    const state = workflowInstance.state || {};
    this.logger.debug(`State snapshot: ${JSON.stringify(state)}`);

    if (step.type === 'END') {
      this.logger.log(`Workflow ${workflowInstance.id} reached END step ${step.id}`);

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
      this.logger.log(`Entering non-action step ${step.type} (${step.id})`);

      await this.workflowHistoryService.record(
        workflowInstance.id,
        step.id,
        `STEP_ENTERED:${step.type}`,
      );

      return;
    }

    await this.executeAction(triggerEvent, step, workflowInstance);
  }

  private getHandler(action: string) {
    this.logger.debug(`Resolving handler for action: ${action}`);

    const handler = this.actionHandlers[action as keyof typeof this.actionHandlers];

    if (!handler) {
      this.logger.error(`Handler not found for action: ${action}`);
      throw new NotFoundException(`Action handler not found: ${action}`);
    }

    return handler;
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

  private resolveTemplate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, rawPath) => {
      const value = rawPath
        .trim()
        .split('.')
        .reduce((acc, key) => acc?.[key], context);

      return value === undefined || value === null ? '' : String(value);
    });
  }

  private extractMappedFields(mapping: Record<string, any>, source: any) {
    this.logger.debug(`Extracting mapped fields`);

    const result: Record<string, any> = {};

    for (const key in mapping) { 
      const map = mapping[key];

      const isMappingEntry =
        typeof map === 'object' &&
        map != null &&
        ['path', 'default', 'transform', 'validation', '$regex', '$options'].some(
          (property) => property in map,
        );

      if (typeof map === 'object' && map && !isMappingEntry && !Array.isArray(map)) {
        result[key] = this.extractMappedFields(map, source);
      } else if (typeof map === 'object' && map) {
        this.logger.debug(`Mapping field "${key}" from path "${map.path}"`);

        let value = map.path ? this.getValueByPath(source, map.path) : undefined;

        if (value === undefined && map.path?.startsWith('data.')) {
          value = this.getValueByPath(source, map.path.replace(/^data\./, ''));
        }

        if (value === undefined) {
          value = map.default ?? null;
        }

        if (map.transform === 'number') value = Number(value);
        if (map.transform === 'string' && value != null) value = String(value);
        if (map.transform === 'boolean') value = Boolean(value);
        if (map.transform === 'map') {

          if (!Array.isArray(value)) return map.default ?? [];

          value = value.map((item, index) => ({
            key: map.map.key === 'index'
              ? String(index + 1) : this.getValueByPath(item, map.map.key),
            label: this.getValueByPath(item, map.map.label),
            value: this.getValueByPath(item, map.map.value),
          }));
        }

        this.validateMappedValue(key, value, map.validation);
        result[key] = value;
      } else if (typeof map === 'string') {
        result[key] = this.getValueByPath(source, map);
      }
    }

    this.logger.debug(`Extracted fields: ${JSON.stringify(result)}`);
    return result;
  }

  private validateMappedValue(
    field: string,
    value: any,
    validation?: WorkflowDataMappingValidation,
  ) {
    if (!validation) return;

    if (validation.required && (value === undefined || value === null || value === '')) {
      this.logger.error(`Validation failed: "${field}" is required`);
      throw new Error(`Response mapping "${field}" is required`);
    }

    if (validation.type && value != null && !this.matchesType(value, validation.type)) {
      this.logger.error(`Validation failed: "${field}" must be ${validation.type}`);
      throw new Error(`Response mapping "${field}" must be of type ${validation.type}`);
    }

    if (validation.enum?.length && value != null && !validation.enum.includes(value)) {
      this.logger.error(`Validation failed: "${field}" not in enum`);
      throw new Error(`Response mapping "${field}" must match allowed values`);
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
      throw new Error(`Response mapping "${field}" pattern mismatch`);
    }
  }

  private matchesType(value: any, type: any) {
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return value && typeof value === 'object' && !Array.isArray(value);
    return typeof value === type;
  }

  private async executeAction(
    triggerEvent: IWorkflowEvent,
    step: WorkflowStep,
    instance: WorkflowInstance,
  ) {
    const mergedConfig = { ...instance.config, ...(step.config || {}) };
    const actionContext = this.buildActionContext(instance.state || {}, triggerEvent);
    const resolvedConfig = this.resolveConfigValue(mergedConfig, actionContext);

    this.logger.log(
      `Executing action "${resolvedConfig.action}" for step ${step.id}`,
    );

    const handler = this.getHandler(resolvedConfig.action);
    const startedAt = Date.now();

    const result = await this.executeActionWithRetry(
      handler,
      resolvedConfig,
      actionContext,
    );

    const durationMs = Date.now() - startedAt;

    this.logger.log(
      `Action completed (success=${result.success}, duration=${durationMs}ms)`,
    );

    let response = {};
    if (result.success && step.config?.responseBodyMapping) {
      response = this.extractMappedFields(step.config.responseBodyMapping, result.data);
    } else if (result.data && typeof result.data === 'object') {
      response = result.data;
    }

    this.logger.debug(`Extracted data: ${JSON.stringify(response)}`);

    const lastAction = {
      stepId: step.id,
      data: response,
      success: result.success,
      errorType: result.metadata?.errorType,
      attempts: result.metadata?.attempts,
    };

    const updatedStepState = {
      response,
      result: null as Record<string, any> | null,
      success: result.success,
      errorType: result.metadata?.errorType,
      attempts: result.metadata?.attempts,
      actions:
        instance.state?.lastAction?.stepId !== step.id
          ? [lastAction]
          : [...(instance.state?.[step.id]?.actions || []), lastAction],
    };

    const updatedState = {
      ...instance.state,
      ...step.config?.defaultValues,
      [step.id]: updatedStepState,
      lastAction,
    };

    const eventPayload = step.config?.resultMapping
      ? this.extractMappedFields(step.config.resultMapping, {
        ...updatedState,
        state: updatedState,
        step: updatedStepState,
        trigger: triggerEvent.state,
        payload: actionContext.payload,
        context: triggerEvent.context,
        metadata: result.metadata,
        event: triggerEvent,
      })
      : response;

    updatedState[step.id] = {
      ...updatedStepState,
      result: eventPayload,
    };

    this.logger.debug(`Updating state for instance ${instance.id}`);

    await this.workflowInstanceService.update(instance.id, {
      state: updatedState,
      config: result.updatedConfig ?? resolvedConfig,
    });

    await this.workflowHistoryService.record(
      instance.id,
      step.id,
      result.success
        ? WorkflowEventType.ACTION_COMPLETED
        : WorkflowEventType.ACTION_FAILED,
    );

    const lifecycleEvent = result.success
      ? WorkflowEventType.ACTION_COMPLETED
      : WorkflowEventType.ACTION_FAILED;
    const primaryEvent = result.nextEvent || lifecycleEvent;
    const eventMeta = {
      source: 'step-runner',
      sequence: Number(triggerEvent?.meta?.sequence ?? 0) + 1,
    };

    this.logger.log(`Emitting event ${primaryEvent}`);

    await this.eventBusService.emit(
      primaryEvent,
      eventPayload || {},
      {
        workflowInstanceId: instance.id,
        flowId: instance.flowId,
        stepId: step.id,
        correlationId: triggerEvent?.context?.correlationId,
      },
      eventMeta,
    );

    if (primaryEvent !== lifecycleEvent) {
      this.logger.log(`Emitting lifecycle event ${lifecycleEvent}`);
      await this.eventBusService.emit(
        lifecycleEvent,
        eventPayload || {},
        {
          workflowInstanceId: instance.id,
          flowId: instance.flowId,
          stepId: step.id,
          correlationId: triggerEvent?.context?.correlationId,
        },
        eventMeta,
      );
    }
  }

  private async executeActionWithRetry(
    handler: any,
    resolvedConfig: Record<string, any>,
    state: Record<string, any>,
  ) {
    const retries = Math.max(0, Number(resolvedConfig.retries ?? 0));
    const retryStrategy = String(resolvedConfig.retryStrategy ?? 'fixed');

    let lastResult: ActionResult | null = null;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      this.logger.log(`Attempt ${attempt}/${retries + 1}`);

      try {
        const result = await handler(resolvedConfig, state);
        lastResult = result;

        if (result.success) {
          this.logger.log(`Action succeeded on attempt ${attempt}`);
          return result;
        }

        this.logger.warn(`Attempt ${attempt} failed: ${result.error}`);
        if (result.nextEvent && attempt === retries + 1) {
          return {
            ...result,
            metadata: {
              ...(result.metadata || {}),
              attempts: attempt,
            },
          };
        }
      } catch (error: any) {
        this.logger.warn(`Attempt ${attempt} threw error: ${error?.message}`);
        lastResult = {
          success: false,
          error: error?.message,
          metadata: {
            errorType: error.name,
          },
        };
      }

      if (attempt <= retries) {
        const delay = this.getRetryDelayMs(attempt, retryStrategy);
        this.logger.debug(`Retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    this.logger.error(`Action failed after all retries`);
    return {
      ...(lastResult || { success: false, error: 'Unknown action failure' }),
      metadata: {
        ...(lastResult?.metadata || {}),
        attempts: retries + 1,
      },
    };
  }

  private getRetryDelayMs(attempt: number, strategy: string, base = 250) {
    switch (strategy) {
      case 'exponential':
        return base * 2 ** (attempt - 1);
      case 'linear':
        return base * attempt;
      default:
        return base;
    }
  }

  private getValueByPath(obj: any, path: string) {
    if (!path) {
      return obj;
    }
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }
}
