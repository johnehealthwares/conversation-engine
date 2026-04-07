import { handleHttpPost } from './http-post.handler';

export function createActionHandlers() {
  return {
    HTTP_POST: handleHttpPost,
    HTTP_REQUEST: handleHttpPost,
  } as const;
}
