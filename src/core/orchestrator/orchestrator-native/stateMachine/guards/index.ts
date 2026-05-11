import { hasExpextedErrorGuard, hasUnexpectedErrorGuard } from "./error-guards";
import { hasFileGuard } from "./file-guards";
import { hasLayoutGuard } from "./layouts-guards";
import {
  isInitialProcessingDoneGuard,
  isNotProccessingRowsGuard,
  isProcessingRowsGuard,
} from "./processing-guards";
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
  | "isInitialProcessingDone";

export const GUARDS = {
  hasExpectedError: hasExpextedErrorGuard,
  hasUnexpectedError: hasUnexpectedErrorGuard,
  hasLayout: hasLayoutGuard,
  hasFile: hasFileGuard,
  ...streamsGuards,
  isNotProccessingRows: isNotProccessingRowsGuard,
  isProcessingRows: isProcessingRowsGuard,
  isInitialProcessingDone: isInitialProcessingDoneGuard,
} as Record<OrchestratorGuards, any>;
