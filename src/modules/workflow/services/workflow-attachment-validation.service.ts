import { Injectable } from '@nestjs/common';
import { QuestionDomain, QuestionnaireDomain, WorkflowDomain } from 'src/shared/domain';
import { WorkflowQuestionStepMapping } from '../entities/workflow-attachment';
import { WorkflowDataMappingEntry, WorkflowStep } from '../entities/workflow-step';

type ValidationLevel = 'error' | 'warning' | 'success';

export type WorkflowAttachmentValidationIssue = {
  level: ValidationLevel;
  code: string;
  message: string;
  stepId?: string;
  attribute?: string;
  questionAttribute?: string;
};

type ValidationContext = {
  workflow: WorkflowDomain;
  questionnaire: QuestionnaireDomain;
  questions: QuestionDomain[];
  mappings: WorkflowQuestionStepMapping[];
};

@Injectable()
export class WorkflowAttachmentValidationService {
  private readonly systemAttributes = [
    'conversationId',
    'participantId',
    'questionnaireId',
    'workflowId',
    'workflowInstanceId',
    'channelId',
  ];

  validate({ workflow, questionnaire, questions, mappings }: ValidationContext) {
    const orderedQuestions = [...questions].sort(
      (a, b) => Number(a.index ?? 0) - Number(b.index ?? 0),
    );
    const issues: WorkflowAttachmentValidationIssue[] = [];
    const stepMap = new Map(workflow.steps.map((step) => [step.id, step]));
    const questionAttributeMap = new Map(
      orderedQuestions.map((question) => [question.attribute, question]),
    );
    const mappingByAttribute = new Map(
      mappings.map((mapping) => [mapping.questionAttribute, mapping]),
    );
    const derivedAttributes = this.getWorkflowDerivedAttributes(workflow.steps);
    const availableAttributes = new Set([
      ...orderedQuestions.map((question) => question.attribute),
      ...this.systemAttributes,
      ...derivedAttributes,
    ]);

    orderedQuestions.forEach((question) => {
      const mapping = mappingByAttribute.get(question.attribute);
      if (!mapping?.workflowStepId) {
        issues.push({
          level: 'warning',
          code: 'QUESTION_NOT_MAPPED',
          message: `Question "${question.attribute}" has no mapped workflow step`,
          questionAttribute: question.attribute,
        });
        return;
      }

      const step = stepMap.get(mapping.workflowStepId);
      if (!step) {
        issues.push({
          level: 'error',
          code: 'STEP_NOT_FOUND',
          message: `Mapped step "${mapping.workflowStepId}" was not found`,
          questionAttribute: question.attribute,
          stepId: mapping.workflowStepId,
        });
        return;
      }

      issues.push({
        level: 'success',
        code: 'QUESTION_STEP_MAPPED',
        message: `Step ${step.id} mapped to question "${question.attribute}"`,
        questionAttribute: question.attribute,
        stepId: step.id,
      });
    });

    workflow.steps.forEach((step) => {
      if (!step.transitions?.length && step.type !== 'END') {
        issues.push({
          level: 'error',
          code: 'STEP_WITHOUT_EXIT',
          message: `Step "${step.id}" has no exit path`,
          stepId: step.id,
        });
      }

      for (const transition of step.transitions ?? []) {
        if (
          transition.nextStepId !== 'END' &&
          !stepMap.has(transition.nextStepId)
        ) {
          issues.push({
            level: 'error',
            code: 'TRANSITION_TARGET_NOT_FOUND',
            message: `Step "${step.id}" points to missing step "${transition.nextStepId}"`,
            stepId: step.id,
          });
        }
      }

      const refs = this.getStepAttributeReferences(step);
      refs.forEach((attribute) => {
        if (!availableAttributes.has(attribute)) {
          issues.push({
            level: 'error',
            code: 'ATTRIBUTE_NOT_FOUND',
            message: `Attribute "${attribute}" not defined`,
            stepId: step.id,
            attribute,
          });
        }
      });

      this.validateResponseMapping(step, issues);
    });

    const reachable = this.getReachableStepIds(workflow.steps);
    workflow.steps.forEach((step) => {
      if (!reachable.has(step.id)) {
        issues.push({
          level: 'warning',
          code: 'UNREACHABLE_STEP',
          message: `Unused step "${step.id}" is not reachable from the workflow start`,
          stepId: step.id,
        });
      }
    });

    const progressivelyAvailable = new Set<string>(this.systemAttributes);
    orderedQuestions.forEach((question) => {
      progressivelyAvailable.add(question.attribute);
      const mapping = mappingByAttribute.get(question.attribute);
      if (!mapping?.workflowStepId) {
        return;
      }
      const step = stepMap.get(mapping.workflowStepId);
      if (!step) {
        return;
      }
      const refs = this.getStepAttributeReferences(step);
      refs.forEach((attribute) => {
        if (
          questionAttributeMap.has(attribute) &&
          !progressivelyAvailable.has(attribute)
        ) {
          issues.push({
            level: 'warning',
            code: 'ATTRIBUTE_USED_BEFORE_COLLECTION',
            message: `Step "${step.id}" uses "${attribute}" before it is collected`,
            stepId: step.id,
            attribute,
          });
        }
      });
    });

    const errors = issues.filter((issue) => issue.level === 'error');
    const warnings = issues.filter((issue) => issue.level === 'warning');
    const successes = issues.filter((issue) => issue.level === 'success');

    return {
      valid: errors.length === 0,
      questionnaireId: questionnaire.id,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      availableAttributes: Array.from(availableAttributes),
      systemAttributes: [...this.systemAttributes],
      workflowDerivedAttributes: derivedAttributes,
      summary: {
        errors: errors.length,
        warnings: warnings.length,
        successes: successes.length,
      },
      issues,
    };
  }

  private validateResponseMapping(
    step: WorkflowStep,
    issues: WorkflowAttachmentValidationIssue[],
  ) {
    const responseMapping = step.config?.responseMapping ?? {};

    for (const [field, mapping] of Object.entries(responseMapping)) {
      if (typeof mapping === 'string') {
        if (!this.isValidPath(mapping)) {
          issues.push({
            level: 'error',
            code: 'INVALID_RESPONSE_MAPPING_PATH',
            message: `Response mapping "${field}" on step "${step.id}" has invalid path "${mapping}"`,
            stepId: step.id,
          });
        }
        continue;
      }

      const typedMapping = mapping as WorkflowDataMappingEntry & {
        path?: string;
        validation?: Record<string, any>;
        dependencies?: string[];
      };

      if (!typedMapping?.path || !this.isValidPath(typedMapping.path)) {
        issues.push({
          level: 'error',
          code: 'INVALID_RESPONSE_MAPPING_PATH',
          message: `Response mapping "${field}" on step "${step.id}" has invalid path`,
          stepId: step.id,
        });
      }

      for (const dependency of typedMapping.dependencies ?? []) {
        if (!dependency || !this.isLikelyAttributeToken(dependency)) {
          continue;
        }
        issues.push({
          level: 'success',
          code: 'RESPONSE_MAPPING_DEPENDENCY',
          message: `Response mapping "${field}" depends on "${dependency}"`,
          stepId: step.id,
          attribute: dependency,
        });
      }
    }
  }

  private getWorkflowDerivedAttributes(steps: WorkflowStep[]) {
    const derived = new Set<string>();

    steps.forEach((step) => {
      Object.keys(step.config?.responseMapping ?? {}).forEach((key) =>
        derived.add(key),
      );
      Object.keys(step.config?.defaultValues ?? {}).forEach((key) =>
        derived.add(key),
      );
    });

    return Array.from(derived);
  }

  private getReachableStepIds(steps: WorkflowStep[]) {
    const stepMap = new Map(steps.map((step) => [step.id, step]));
    const visited = new Set<string>();
    const start = steps[0]?.id;

    if (!start) {
      return visited;
    }

    const visit = (stepId: string) => {
      if (!stepId || visited.has(stepId) || stepId === 'END') {
        return;
      }
      visited.add(stepId);
      const step = stepMap.get(stepId);
      step?.transitions?.forEach((transition) => visit(transition.nextStepId));
    };

    visit(start);
    return visited;
  }

  private getStepAttributeReferences(step: WorkflowStep) {
    const refs = new Set<string>();

    this.extractConditionAttributes(step, refs);
    this.extractTemplateAttributes(step.config, refs);
    this.extractResultMappingDependencies(step, refs);

    return Array.from(refs);
  }

  private extractConditionAttributes(step: WorkflowStep, refs: Set<string>) {
    const conditionTokens = [
      ...(step.transitions ?? []).flatMap((transition) =>
        this.tokenizeExpression(transition.condition),
      ),
    ];

    conditionTokens.forEach((token) => refs.add(token));
  }

  private extractTemplateAttributes(value: unknown, refs: Set<string>) {
    if (typeof value === 'string') {
      const templateMatches = value.match(/\{\{\s*([^}]+)\s*\}\}/g) ?? [];
      templateMatches
        .map((match) => match.replace(/\{\{|\}\}/g, '').trim())
        .flatMap((match) => this.tokenizeExpression(match))
        .forEach((token) => refs.add(token));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => this.extractTemplateAttributes(item, refs));
      return;
    }

    if (value && typeof value === 'object') {
      Object.values(value).forEach((item) =>
        this.extractTemplateAttributes(item, refs),
      );
    }
  }

  private extractResultMappingDependencies(step: WorkflowStep, refs: Set<string>) {
    Object.values(step.config?.resultMapping ?? {}).forEach((mapping) => {
      if (typeof mapping === 'string') {
        return;
      }
      (mapping.dependencies ?? []).forEach((dependency: string) => {
        if (this.isLikelyAttributeToken(dependency)) {
          refs.add(dependency);
        }
      });
    });
  }

  private tokenizeExpression(expression?: string) {
    if (!expression) {
      return [];
    }

    const rawTokens = expression.match(/[A-Za-z_][A-Za-z0-9_.]*/g) ?? [];
    const ignored = new Set([
      'true',
      'false',
      'null',
      'undefined',
      'payload',
      'state',
      'env',
      'data',
      'length',
    ]);

    return rawTokens
      .map((token) =>
        token.startsWith('state.')
          ? token.replace(/^state\./, '')
          : token.startsWith('payload.')
            ? token.replace(/^payload\./, '')
            : token.startsWith('env.')
              ? ''
              : token,
      )
      .filter((token) => token && !ignored.has(token))
      .filter((token) => this.isLikelyAttributeToken(token));
  }

  private isLikelyAttributeToken(token: string) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(token);
  }

  private isValidPath(path: string) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(
      path,
    );
  }
}
