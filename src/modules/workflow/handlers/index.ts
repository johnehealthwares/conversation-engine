import { handleEmitEvent } from './emit-event.handler';
import { handleHttpGet, handleHttpPost, handleHttpRequest } from './http-post.handler';

export function createActionHandlers() {
  return {
    HTTP_POST: handleHttpPost,
    HTTP_GET: handleHttpGet,
    HTTP_REQUEST: handleHttpRequest,
    EMIT_EVENT: handleEmitEvent,
    WORKFLOW_ASK_OPTIONS: handleEmitEvent,
    WORKFLOW_NO_OPTIONS_FOUND: handleEmitEvent,
  } as const;
}
