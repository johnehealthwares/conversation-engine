

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

export interface ConversationHistoryItem {
  role: string;
  text: string;
}

export interface IntentRequest {
  text: string;
  sender_role: string;
  active_flow?: string;
  conversation_id?: string;
  patient_id?: string;
  context_summary?: string;
  conversation_history?: ConversationHistoryItem[];
  previous_provisional_intent?: string;
  previous_clarifying_question?: string;
  persist_history?: boolean;
  store_assistant_response?: boolean;
  history_window?: number;
  metadata?: Record<string, any>;
  max_candidates?: number;
}

export interface IntentCandidate {
  intent: string;
  confidence: number;
}

export interface IntentResponse {
  conversation_id: string;
  intent: string;
  flow?: string;
  keyword?: string;
  confidence?: number;
  response?: string;
  route_target?: string;
  status?: string;
  next_action?: string;
  clarifying_question?: string | null;
  provisional_intent?: string | null;
  should_trigger_downstream?: boolean;
  trigger_target?: string;
  loaded_history_count?: number;
  top_candidates?: IntentCandidate[];
  entities?: Record<string, any>;
}


@Injectable()
export class IntentService {
  private readonly baseUrl =
    'https://whatsapp-intent-api.onrender.com/v1/intent/classify';

  constructor(private readonly httpService: HttpService) {}


async classify(text: string): Promise<IntentResponse> {
  const response = await this.classifyIntent({ text,  sender_role: 'patient' });
  return response;

}
  private async classifyIntent(payload: IntentRequest): Promise<IntentResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<IntentResponse>(this.baseUrl, payload, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }),
      );

      return response.data;
    } catch (error) {
      throw new HttpException(
        error?.response?.data || 'Intent API request failed',
        error?.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}