import { assign } from "xstate";
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
  initialProcessingDone: false,
  step: [],
  abortController: new AbortController(),
};

export const resetOrchestratorAction = assign(({ context }) => {
  context.abortController.abort();

  return {
    ...context,
    ...defaultState,
    abortController: new AbortController(),
  };
});
