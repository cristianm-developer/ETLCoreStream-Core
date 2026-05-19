import type { ILoggerModule } from "@/core/logger/i-logger-module";
import type { ProviderModule } from "@/core/provider/main";
import type { FileMetrics, LayoutBase, RowObject } from "@/shared";
import type { RecoverPoint } from "@/shared/schemes/recover-point";
import type { ViewPaginationInfo } from "@/shared/schemes/view-pagination";
import type { Signal } from "@preact/signals-core";

export interface OrchestratorContext {
  logger: ILoggerModule | null;

  modules: ProviderModule["modules"] | null;
  settings: ProviderModule["options"] | null;

  layout: LayoutBase | null;
  metrics: FileMetrics | null;

  file: File | null;

  errors: {
    unexpected: Error | null;
    expected: Error | null;
  };

  streams: {
    importStream: ReadableStream | null;
    mappingStream: ReadableStream | null;
    localStepsStream: ReadableStream | null;
  };

  progress: { label: string; value: number | null }[] | null;
  totalEstimatedRows: Signal<number | null> | null;

  initialPersistenceDone: boolean | null;
  initialGlobalStepsDone: boolean | null;

  initialProcessingDone: boolean | null;
  processingRows: boolean | null;

  mappingColumnMapEntries: [string, string][] | null;

  currentRows: RowObject[] | null;

  viewPaginationInfo: ViewPaginationInfo;

  editPayload: {
    rowId: number;
    key: string;
    value: string;
  } | null;

  step: string[];
  abortController: AbortController;

  checkRecoverPoint: boolean;
  wantToRecoverPoint: boolean | null;
  recoveryPoint: RecoverPoint | null;
}

export const EMPTY_CONTEXT: OrchestratorContext = {
  currentRows: null,
  editPayload: null,
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
  progress: [],
  totalEstimatedRows: null,
  initialProcessingDone: false,
  processingRows: false,
  mappingColumnMapEntries: null,
  viewPaginationInfo: {
    currentPage: 1,
    totalPages: 1,
    currentFilter: {},
  },
  logger: null,
  modules: null,
  settings: null,
  step: [],
  abortController: new AbortController(),
  initialGlobalStepsDone: false,
  initialPersistenceDone: false,

  checkRecoverPoint: false,
  wantToRecoverPoint: null,
  recoveryPoint: null,
};
