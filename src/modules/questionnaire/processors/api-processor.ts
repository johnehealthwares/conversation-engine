import { Injectable, Logger } from '@nestjs/common';
import { ConversationDomain } from '../../../shared/domain';

export type ApiNavigationConfig = {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payloadMapping?: Record<string, any>;
  headers?: Record<string, string>;
  auth?: {
    type: 'NONE' | 'BEARER' | 'API_KEY';
    tokenKey?: string;
    headerName?: string;
  };
  conditions?: {
    condition: string;
    nextQuestionId: string;
  }[];
  defaultNextQuestionId?: string;
  responseMapping?: {
    metadataKey: string;
  };
  followUpRequests?: Array<{
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    payloadMapping?: Record<string, any>;
    headers?: Record<string, string>;
    auth?: {
      type: 'NONE' | 'BEARER' | 'API_KEY';
      tokenKey?: string;
      headerName?: string;
    };
    condition?: string;
    responseMapping?: {
      metadataKey: string;
    };
  }>;
};

export type ApiExecutionResult = {
  nextQuestionId?: string;
  metadata?: Record<string, any>;
  rawResponse?: any;
};

@Injectable()
export class ApiProcessorFacade {
  private readonly logger = new Logger(ApiProcessorFacade.name);

  async execute(
    config: ApiNavigationConfig,
    answer: string,
    conversation: ConversationDomain,
  ): Promise<ApiExecutionResult> {
    this.logger.debug(`Executing API navigation for URL: ${config.url}`);
    const requestContext = this.buildTemplateContext(answer, conversation);
    const payload = this.mapPayload(config.payloadMapping, requestContext);
    const headers = this.buildHeaders(config, conversation, requestContext);
    const url = this.resolveTemplate(config.url, requestContext);

    this.logger.verbose(`Request payload: ${JSON.stringify(payload)}`);
    this.logger.verbose(`Request headers: ${JSON.stringify(headers)}`);
    this.logger.verbose(`Resolved URL: ${url}`);

    const response = await fetch(url, {
      method: config.method || 'POST',
      headers,
      body: config.method === 'GET' ? undefined : JSON.stringify(payload),
    });

    const data = await response.json();
    this.logger.debug(`Received response from ${url}: ${JSON.stringify(data)}`);

    let metadata = this.buildMetadata(data, config.responseMapping?.metadataKey);

    // Process follow-up requests
    for (const request of config.followUpRequests || []) {
      if (
        request.condition &&
        !this.evaluateCondition(request.condition, {
          response: data,
          status: response.status,
          metadata,
        })
      ) {
        this.logger.verbose(`Skipping follow-up request due to condition: ${request.condition}`);
        continue;
      }

      const followUpContext = {
        ...requestContext,
        response: data,
        metadata,
      };
      const followUpPayload = this.mapPayload(request.payloadMapping, followUpContext);
      const followUpHeaders = this.buildHeaders(request, conversation, followUpContext);
      const followUpUrl = this.resolveTemplate(request.url, followUpContext);

      this.logger.debug(`Executing follow-up request to URL: ${followUpUrl}`);
      this.logger.verbose(`Follow-up payload: ${JSON.stringify(followUpPayload)}`);
      this.logger.verbose(`Follow-up headers: ${JSON.stringify(followUpHeaders)}`);

      const followUpResponse = await fetch(followUpUrl, {
        method: request.method || 'POST',
        headers: followUpHeaders,
        body: request.method === 'GET' ? undefined : JSON.stringify(followUpPayload),
      });

      const followUpData = await followUpResponse.json();
      this.logger.debug(`Follow-up response: ${JSON.stringify(followUpData)}`);

      metadata = {
        ...metadata,
        ...this.buildMetadata(followUpData, request.responseMapping?.metadataKey),
      };
    }

    // Evaluate conditions
    for (const cond of config.conditions || []) {
      if (this.evaluateCondition(cond.condition, { response: data, status: response.status })) {
        this.logger.log(`Condition matched, nextQuestionId: ${cond.nextQuestionId}`);
        return {
          nextQuestionId: cond.nextQuestionId,
          metadata,
          rawResponse: data,
        };
      }
    }

    this.logger.log(`No condition matched, using defaultNextQuestionId: ${config.defaultNextQuestionId}`);
    return {
      nextQuestionId: config.defaultNextQuestionId,
      metadata,
      rawResponse: data,
    };
  }

  /* -------------------- HELPERS -------------------- */

  private mapPayload(mapping: Record<string, any> = {}, context: Record<string, any>) {
    const payload: Record<string, any> = {};

    for (const key of Object.keys(mapping)) {
      payload[key] = this.resolveValue(mapping[key], context);
    }

    this.logger.verbose(`Mapped payload: ${JSON.stringify(payload)}`);
    return payload;
  }

  private buildHeaders(
    config: Pick<ApiNavigationConfig, 'headers' | 'auth'>,
    conversation: ConversationDomain,
    requestContext: Record<string, any>,
  ): Record<string, string> {
    console.log({config})
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...Object.entries(config.headers || {}).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: this.resolveTemplate(value, requestContext),
        }),
        {},
      ),
    };

    if (!config.auth || config.auth.type === 'NONE') {
      this.logger.verbose(`No authentication applied for headers`);
      return headers;
    }

    const token =
      conversation.context[config.auth.tokenKey || ''] ||
      process.env[config.auth.tokenKey || ''];

    switch (config.auth.type) {
      case 'BEARER':
        if (token) headers['Authorization'] = `Bearer ${token}`;
        break;
      case 'API_KEY':
        if (token && config.auth.headerName) {
          headers[config.auth.headerName] = token;
        }
        break;
    }

    this.logger.verbose(`Built headers with auth: ${JSON.stringify(headers)}`);
    return headers;
  }

  private evaluateCondition(condition: string, context: any): boolean {
    try {
      const result = new Function('ctx', `with(ctx) { return ${condition} }`)(context);
      this.logger.verbose(`Condition "${condition}" evaluated to ${result}`);
      return result;
    } catch (err) {
      this.logger.error(`Failed to evaluate condition "${condition}"`, err);
      return false;
    }
  }

  private buildMetadata(response: any, metadataKey?: string) {
    const normalizedResponse = this.normalizeResponse(response);
    const count = Array.isArray(normalizedResponse) ? normalizedResponse.length : 1;
    const metadata: Record<string, any> = {
      matches: normalizedResponse,
      count,
    };

    if (metadataKey) {
      metadata[metadataKey] = normalizedResponse;
      metadata[`${metadataKey}Count`] = count;
    }

    if (
      Array.isArray(normalizedResponse) &&
      normalizedResponse.length === 1 &&
      this.looksLikeClientRecord(normalizedResponse[0])
    ) {
      metadata.selectedClient = normalizedResponse[0];
      metadata.selectedClientId =
        normalizedResponse[0]?._id || normalizedResponse[0]?.id;
      metadata.clientId = metadata.selectedClientId;
    }

    this.logger.verbose(`Built metadata: ${JSON.stringify(metadata)}`);
    return metadata;
  }

  private buildTemplateContext(
    answer: string,
    conversation: ConversationDomain,
  ): Record<string, any> {
    const context = {
      answer,
      encodedAnswer: encodeURIComponent(answer),
      context: conversation.context || {},
      env: process.env,
    };
    this.logger.verbose(`Template context built: ${JSON.stringify(context)}`);
    return context;
  }

  private resolveValue(value: any, context: Record<string, any>) {
    if (typeof value === 'string') {
      return this.resolveTemplate(value, context);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, context));
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).reduce((acc, [key, item]) => {
        acc[key] = this.resolveValue(item, context);
        return acc;
      }, {} as Record<string, any>);
    }

    return value;
  }

  private resolveTemplate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, rawPath) => {
      const value = this.readPath(context, rawPath.trim());
      return value === undefined || value === null ? '' : String(value);
    });
  }

  private readPath(source: Record<string, any>, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], source);
  }

  private normalizeResponse(response: any) {
    if (!Array.isArray(response)) {
      return response;
    }

    return response.map((item) => {
      if (!item || typeof item !== 'object') {
        return item;
      }

      const fullName = [item.firstname, item.middlename, item.lastname]
        .filter(Boolean)
        .join(' ')
        .trim();
      const displayLabel = fullName
        ? [fullName, item.phone, item.email].filter(Boolean).join(' - ')
        : item.facilityName || item.name || item.email || item.phone;

      return {
        ...item,
        id: item.id || item._id,
        displayLabel,
      };
    });
  }

  private looksLikeClientRecord(value: any): boolean {
    return Boolean(
      value &&
      typeof value === 'object' &&
      (value.firstname || value.lastname || value.email || value.phone),
    );
  }
}