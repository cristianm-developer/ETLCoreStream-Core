import { assign } from "xstate";
import type { OrchestratorContext } from "../schemes/context";
import type { ProgressUpdatedEvent } from "../events/modules-events";

export const updateProgressAction = assign(
  ({ context, event }: { context: OrchestratorContext; event: ProgressUpdatedEvent }) => {
    if (event.type !== "PROGRESS_UPDATED") return context;

    const progressWithoutCurrent =
      context.progress?.filter((p) => p.label !== event.progress.label) ?? [];

    if (event.progress.value === null) {
      return {
        ...context,
        progress: progressWithoutCurrent,
      };
    } else {
      return {
        ...context,
        progress: [...progressWithoutCurrent, event.progress],
      };
    }
  }
);

export const updateEstimatedRowsAction = assign(({ context, event }) => {
  if (event.type !== "ESTIMATED_ROWS_UPDATED") return context;

  return {
    ...context,
    totalEstimatedRows: event.totalEstimatedRows,
  };
});
