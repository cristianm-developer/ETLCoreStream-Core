import { assign } from "xstate";
import { mainStateMachineSetup } from "../state-machine-root";
import type { OrchestratorContext } from "../schemes/context";

export const defaultState: Partial<OrchestratorContext> = {
  errors: {
    unexpected: null,
    expected: null,
  },
  file: null,
  metrics: null,
  layout: null,
  streams: {
    importStream: null,
    mappingStream: null,
    localStepsStream: null,
  },
  processingRows: false,
  mappingColumnMapEntries: null,
  totalEstimatedRows: null,
  progress: [],
  viewPaginationInfo: {
    currentPage: 1,
    totalPages: 1,
    currentFilter: {},
  },
  initialProcessing: false,
  step: [],
};

export const resetOrchestratorAction = mainStateMachineSetup.createAction(
  assign(({ context }) => ({
    ...context,
    ...defaultState,
  }))
);
