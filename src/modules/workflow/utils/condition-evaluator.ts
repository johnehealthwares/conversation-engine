export function evaluateCondition(condition: string, payload: any): boolean {
  try {
    const fn = new Function(
      'payload',
      `with (payload ?? {}) { return (${condition}); }`,
    );
    return fn(payload);
  } catch (e) {
    return false;
  }
}
