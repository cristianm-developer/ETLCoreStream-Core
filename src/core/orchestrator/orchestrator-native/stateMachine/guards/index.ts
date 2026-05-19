import { hasExpextedErrorGuard, hasUnexpectedErrorGuard } from "./error-guards";
import { hasFileGuard } from "./file-guards";
import { hasLayoutGuard } from "./layouts-guards";
import {
  hasMetricsGuard,
  isInitialProcessingDoneGuard,
  isNotProccessingRowsGuard,
  isProcessingRowsGuard,
} from "./processing-guards";
import type { RecoverPointGuards } from "./recover-point-guards";
import { recoverPointGuards } from "./recover-point-guards";
import type { StreamsGuards } from "./streams-guards";
import { streamsGuards } from "./streams-guards";

export type OrchestratorGuards =
  | "hasExpectedError"
  | "hasUnexpectedError"
  | "hasLayout"
  | "hasFile"
  | StreamsGuards
  | "isNotProccessingRows"
  | "isProcessingRows"
  | "isInitialProcessingDone"
  | "hasMetrics"
  | RecoverPointGuards;

export const GUARDS = {
  hasExpectedError: hasExpextedErrorGuard,
  hasUnexpectedError: hasUnexpectedErrorGuard,
  hasLayout: hasLayoutGuard,
  hasFile: hasFileGuard,
  ...streamsGuards,
  isNotProccessingRows: isNotProccessingRowsGuard,
  isProcessingRows: isProcessingRowsGuard,
  isInitialProcessingDone: isInitialProcessingDoneGuard,
  hasMetrics: hasMetricsGuard,
  ...recoverPointGuards,
} as Record<OrchestratorGuards, any>;
