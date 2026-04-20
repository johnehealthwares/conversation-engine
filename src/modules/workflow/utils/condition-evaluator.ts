export function evaluateCondition(condition: string, payload: any): boolean {
  try {
    const fn = new Function(
      'payload',
      `with (payload ?? {}) { return (${condition}); }`,
    );

    const result = fn(payload);

    console.debug('[evaluateCondition] success', {
      condition,
      payload,
      result,
    });

    return result;
  } catch (error: any) {
    console.error('[evaluateCondition] failed', {
      condition,
      payload,
      error: error?.message,
      stack: error?.stack,
    });

    return false;
  }
}