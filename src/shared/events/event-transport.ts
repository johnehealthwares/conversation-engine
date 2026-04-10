export const EVENT_TRANSPORT = Symbol('EVENT_TRANSPORT');

export interface EventTransport {
  emit(eventName: string, payload: unknown): Promise<unknown[]>;
}
