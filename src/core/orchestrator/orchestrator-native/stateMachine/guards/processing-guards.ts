import type { OrchestratorContext } from "../schemes/context";

export const isProcessingRowsGuard = ({ context }: { context: OrchestratorContext }) =>
  context.processingRows;
export const isNotProccessingRowsGuard = ({ context }: { context: OrchestratorContext }) =>
  !context.processingRows;

export const isInitialProcessingDoneGuard = ({ context }: { context: OrchestratorContext }) =>
  context.initialProcessingDone;

export const hasMetricsGuard = ({ context }: { context: OrchestratorContext }) =>
  context.metrics !== null;
