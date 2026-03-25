export const DEFAULT_MAX_REVIEW_LOOPS = 2;
export const HARD_MAX_REVIEW_LOOPS = 4;

export const LAUNCH_CRITIQUE_PASS_THRESHOLD = 0.75;
export const TARGET_CRITIQUE_PASS_THRESHOLD = 0.8;

export const MAX_TOOL_CALLS_PER_REQUEST = 3;
export const TOOL_EXECUTION_TIMEOUT_MS = 7_000;

export function clampReviewLoops(value?: number) {
  if (!value || value < 1) return DEFAULT_MAX_REVIEW_LOOPS;
  return Math.min(value, HARD_MAX_REVIEW_LOOPS);
}
