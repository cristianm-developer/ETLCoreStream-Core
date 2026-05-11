import { assign } from "xstate";
import { mainStateMachineSetup } from "../state-machine-root";

export const updateProgressAction = mainStateMachineSetup.createAction(
  assign(({ context, event }) => {
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
  })
);

export const updateEstimatedRowsAction = mainStateMachineSetup.createAction(
  assign(({ context, event }) => {
    if (event.type !== "ESTIMATED_ROWS_UPDATED") return context;

    return {
      ...context,
      totalEstimatedRows: event.totalEstimatedRows,
    };
  })
);
