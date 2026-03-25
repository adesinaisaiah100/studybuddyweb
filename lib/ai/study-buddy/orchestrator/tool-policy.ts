import {
  MAX_TOOL_CALLS_PER_REQUEST,
  TOOL_EXECUTION_TIMEOUT_MS,
} from "@/lib/ai/study-buddy/orchestrator/constants";

export type ToolExecutionBudget = {
  maxCalls: number;
  timeoutMs: number;
};

export function getToolExecutionBudget(): ToolExecutionBudget {
  return {
    maxCalls: MAX_TOOL_CALLS_PER_REQUEST,
    timeoutMs: TOOL_EXECUTION_TIMEOUT_MS,
  };
}

export function hasBudgetRemaining(input: {
  callsUsed: number;
  elapsedMs: number;
  budget: ToolExecutionBudget;
}) {
  return (
    input.callsUsed < input.budget.maxCalls &&
    input.elapsedMs < input.budget.timeoutMs
  );
}
