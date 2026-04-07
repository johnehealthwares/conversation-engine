import axios from 'axios';
import { WorkflowEventType } from '../entities/step-transition';

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

export async function handleHttpPost(
  config: Record<string, any>,
  state: Record<string, any>,
): Promise<ActionResult> {
  try {
    const nextConfig = { ...config };
    const now = new Date();
    const expiryTime = nextConfig.expiryTime ? new Date(nextConfig.expiryTime) : null;
    const baseUrl = nextConfig.baseUrl || nextConfig.url?.split('/').slice(0, 3).join('/');

    if (!expiryTime || Number.isNaN(expiryTime.getTime()) || expiryTime <= now) {
      const authResponse = await axios.post(
        `${baseUrl}/authentication`,
        {
          strategy: 'local',
          email: nextConfig.username,
          password: nextConfig.password,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      nextConfig.accessToken = authResponse.data?.accessToken ?? nextConfig.accessToken ?? null;
      nextConfig.expiryTime = addDuration(now, nextConfig.accessTokenDuration).toISOString();
    }

    const headers = {
      ...(nextConfig.headers ?? {}),
      ...(nextConfig.accessToken
        ? {
            Authorization:
              nextConfig.headers?.Authorization ??
              `Bearer ${nextConfig.accessToken}`,
          }
        : {}),
    };

    const response = await axios.post(nextConfig.url, state, { headers });

    return {
      success: true,
      data: {
        data: response.data,
      },
      metadata: {
        status: response.status,
      },
      updatedConfig: nextConfig,
    };
  } catch (err: any) {
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
