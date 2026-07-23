const retryableStoryStatuses = new Set([408, 425, 429, 503, 504]);

export function classifyStoryPlanUpdate(previousResult, status, nextResult) {
  if (status >= 200 && status < 300) return { kind: "accepted", result: nextResult };
  if (retryableStoryStatuses.has(status)) return { kind: "retry", result: previousResult };
  return { kind: "terminal", result: nextResult };
}
