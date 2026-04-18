import axios from 'axios';
import { WorkflowEventType } from '../entities/step-transition';
import { WorkflowDataMapping, WorkflowDataMappingEntry, WorkflowStepConfig } from '../entities/workflow-step';
import { Logger } from '@nestjs/common';

export type ActionResult = {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  metadata?: Record<string, any>;
  nextEvent?: WorkflowEventType;
  updatedConfig?: Record<string, any>;
};

function addDuration(date: Date, duration?: string | number) {
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return new Date(date.getTime() + duration);
  }

  const numericDuration = Number(duration);
  if (Number.isFinite(numericDuration) && numericDuration > 0) {
    return new Date(date.getTime() + numericDuration);
  }

  return new Date(date.getTime() + 60 * 60 * 1000);
}

function getValueByPath(obj: Record<string, any>, path: string) {
  if (!path) return obj;
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

function applyTransform(value: any, transform?: 'string' | 'number' | 'boolean' | { prepend?: string; append?: string }) {

  if (value == null || transform == null) return value;


  switch (transform) {
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'string':
      return String(value);
    default:
      if ('prepend' in transform) return String(transform.prepend) + value;
      return value;
  }
}

function mapData(source: Record<string, any>, mapping?: WorkflowDataMapping): Record<string, any> {
  if (!mapping) return {};

  const result: Record<string, any> = {};

  for (const key in mapping) {
    const entry = mapping[key];

    // 1️⃣ Simple string path
    if (typeof entry === 'string') {
      result[key] = getValueByPath(source, entry);
      continue;
    }

    // 2️⃣ $regex mapping
    if (entry.$regex) {
      const rawValue = getValueByPath(source, entry.$regex.path);
      if (rawValue !== undefined) {
        result[key] = { $regex: rawValue, $options: entry.$options || '' };
      }
      continue;
    }

    // 3️⃣ Standard path with optional default & transform
    if (entry.path) {
      let value = getValueByPath(source, entry.path);
      if (value === undefined && entry.default !== undefined) value = entry.default;
      value = applyTransform(value, entry.transform);
      result[key] = value;
      continue;
    }
    if(entry.default && !entry.path){
      result[key] = entry.default;
      continue;
    }

    // 4️⃣ Nested object (child nodes)
    result[key] = mapData(source, entry);
  }

  return result;
}

export async function handleHttpPost(
  config: WorkflowStepConfig,
  state: Record<string, any>
): Promise<ActionResult> {
  return handleHttp(config, state, 'POST');
}


export async function handleHttpGet(
  config: WorkflowStepConfig,
  state: Record<string, any>
): Promise<ActionResult> {
  return handleHttp(config, state, 'GET');
}

export async function handleHttpRequest(
  config: WorkflowStepConfig,
  state: Record<string, any>,
): Promise<ActionResult> {
  const method = String(config.method || 'POST').toUpperCase() === 'GET'
    ? 'GET'
    : 'POST';
  return handleHttp(config, state, method);
}

export async function handleHttp(
  config: WorkflowStepConfig,
  state: Record<string, any>,
  method: 'GET' | 'POST'
): Promise<ActionResult> {
  const logger = new Logger('HttpHandler');
  try {
    const nextConfig = { ...config };

    const headers = {
      ...(nextConfig.headers || {}),
      ...mapData({ ...state, ...nextConfig }, nextConfig.headersMapping),
    };
    const params = {
      ...(nextConfig.params || {}),
      ...mapData(state, nextConfig.queryMapping),
    };
    const requestBodyMapping =
      nextConfig.requestBodyMapping || nextConfig.mapping || nextConfig.requestBodyMapping;
    const body = mapData({ ...state, ...nextConfig }, requestBodyMapping);

    logger.log(`HTTP ${method} Request → ${nextConfig.url}`);
    logger.debug({
      headers,
      params,
      body: method === 'GET' ? undefined : body,
    });
    const start = Date.now();

    const responseBody = await axios.request({
      method,
      url: nextConfig.url,
      headers,
      params,
      data: method === 'GET' ? undefined : body,
    });

    logger.log(`HTTP ${method} Response ← ${nextConfig.url} [${responseBody.status}]`);
    logger.debug({
      response: responseBody.data,
    });
    logger.log(
      `HTTP ${method} ${nextConfig.url} completed in ${Date.now() - start}ms`
    );
    return {
      success: true,
      data: responseBody.data,
      metadata: {
        status: responseBody.status,
        headers: responseBody.headers,
      },
      updatedConfig: nextConfig,
    };
  } catch (err: any) {
    logger.error(`HTTP ${method} Error ← ${config.url}`, err.stack || err.message);

    return {
      success: false,
      error: err.message,
      metadata: {
        status: err.response?.status,
      },
      updatedConfig: config,
    };
  }
}
