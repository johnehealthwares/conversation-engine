// services/workflow-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IWorkflowEvent } from '../interfaces/event.interface';
import { WorkflowInstanceService } from '../services/workflow-instance';
import { WorkflowService } from '../services/workflow-service';
import { evaluateCondition } from '../utils/condition-evaluator';
import axios from 'axios';

@Injectable()
export class WorkflowProcessorService {
  private readonly logger = new Logger(WorkflowProcessorService.name);

  constructor(
    private readonly instanceService: WorkflowInstanceService,
    private readonly workflowService: WorkflowService,
  ) {}

  // ---------------------------
  // GENERIC HANDLER
  // ---------------------------
  private async processEvent(eventType: string, event: IWorkflowEvent) {
    const workflowInstanceId = event.context?.workflowInstanceId;
    if (!workflowInstanceId) {
      this.logger.warn(
        `[workflow:event] Missing workflowInstanceId for event=${eventType}`,
      );
      return;
    }

    this.logger.debug(
      `[workflow:event] type=${eventType} instance=${workflowInstanceId} step=${event.context?.stepId || 'n/a'}`,
    );

    const instance = await this.instanceService.findById(workflowInstanceId);
    const workflow = await this.workflowService.findById(instance.workflowId);
    if(!workflow) return;
    if (!instance.currentStepId) return;

    const step = workflow.steps.find(s => s.id === instance.currentStepId);
    if (!step) return;

    // 1️⃣ Merge payload into state
    const updatedState = {
      ...instance.state,
      ...(event.payload || {}),
    };

    // 2️⃣ Find matching transition
    const transition = step.transitions.find(t => {
      if (t.event !== eventType) return false;
      return !t.condition || evaluateCondition(t.condition, updatedState);
    });

    if (!transition) return;

    // 3️⃣ Move to next step
    const nextStep = workflow.steps.find(s => s.id === transition.nextStepId);

    await this.instanceService.update(instance.id, {
      currentStepId: transition.nextStepId,
      state: updatedState,
    });

    // 4️⃣ Execute step if needed
    if (nextStep) {
      await this.executeStep(nextStep, instance.id, updatedState);
    }
  }

  async handleEvent(event: IWorkflowEvent) {
    await this.processEvent(event.type, event);
  }

  // ---------------------------
  // STEP EXECUTION
  // ---------------------------
  private async executeStep(
    step: any,
    workflowInstanceId: string,
    state: Record<string, any>
  ) {
    switch (step.type) {
      case 'ACTION':
        await this.executeAction(step, workflowInstanceId, state);
        break;

      case 'END':
        await this.instanceService.update(workflowInstanceId, {
          status: 'COMPLETED',
        });
        break;

      case 'QUESTIONNAIRE':
      case 'WAIT':
      default:
        // do nothing — wait for next event
        break;
    }
  }

  // ---------------------------
  // ACTION EXECUTOR
  // ---------------------------
  private async executeAction(
    step: any,
    workflowInstanceId: string,
    state: Record<string, any>
  ) {
    try {
      const {
        action,
        url,
        method,
        mapping,
        payload: explicitPayload,
        headers,
        saveResponseToState,
      } = step.config || {};

      let payload = { ...state };

      // Optional mapping
      if (mapping) {
        payload = Object.keys(mapping).reduce((acc, key) => {
          acc[key] = this.resolveConfigValue(mapping[key], state);
          return acc;
        }, {} as Record<string, any>);
      } else if (explicitPayload) {
        payload = this.resolveConfigValue(explicitPayload, state);
      }

      let responseData: Record<string, any> = {};

      if ((action === 'HTTP_POST' || action === 'HTTP_REQUEST') && url) {
        const resolvedUrl = this.resolveTemplate(url, {
          state,
          ...state,
          env: process.env,
        });
        const resolvedHeaders = this.resolveConfigValue(headers || {}, state);
        const response = await axios.request({
          url: resolvedUrl,
          method: method || 'POST',
          headers: resolvedHeaders,
          data: method === 'GET' ? undefined : payload,
        });
        responseData = response.data || {};
      }

      // emit ACTION_COMPLETED
      await this.processEvent('ACTION_COMPLETED', {
        id: `action-completed:${workflowInstanceId}`,
        type: 'ACTION_COMPLETED',
        payload: this.mapResponseToState(responseData, saveResponseToState, state),
        context: { workflowInstanceId },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      this.logger.error('Action execution failed', error);

      // Optional: emit failure event
      await this.processEvent('ACTION_FAILED', {
        id: `action-failed:${workflowInstanceId}`,
        type: 'ACTION_FAILED',
        payload: { error: error.message },
        context: { workflowInstanceId },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private mapResponseToState(
    responseData: Record<string, any>,
    mapping?: Record<string, any>,
    state?: Record<string, any>,
  ): Record<string, any> {
    if (!mapping) {
      return {};
    }

    return Object.entries(mapping).reduce((acc, [key, value]) => {
      acc[key] = this.resolveTemplate(String(value), {
        response: responseData,
        state: state || {},
        env: process.env,
      });
      return acc;
    }, {} as Record<string, any>);
  }

  private resolveConfigValue(value: any, state: Record<string, any>): any {
    if (typeof value === 'string') {
      if (!value.includes('{{') && Object.prototype.hasOwnProperty.call(state, value)) {
        return state[value];
      }
      return this.resolveTemplate(value, { state, ...state, env: process.env });
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

  // ---------------------------
  // EVENT HANDLERS
  // ---------------------------

  @OnEvent('CONVERSATION_STARTED')
  async handleConversationStarted(event: IWorkflowEvent) {
    await this.handleEvent(event);
  }

  @OnEvent('ANSWER_VALID')
  async handleAnswerValid(event: IWorkflowEvent) {
    await this.handleEvent(event);
  }

  @OnEvent('CONVERSATION_COMPLETED')
  async handleConversationCompleted(event: IWorkflowEvent) {
    await this.handleEvent(event);
  }

  @OnEvent('CONVERSATION_STOPPED')
  async handleConversationStopped(event: IWorkflowEvent) {
    await this.processEvent('CONVERSATION_STOPPED', event);

    // optionally force stop
    const workflowInstanceId = event.context?.workflowInstanceId;
    if (!workflowInstanceId) {
      return;
    }

    await this.instanceService.update(workflowInstanceId, {
      status: 'STOPPED',
    });
  }
}
