import type { ILoggerModule } from "@/core/logger/i-logger-module";
import type { ProviderModule } from "@/core/provider/main";
import type { FileMetrics, LayoutBase, RowObject } from "@/shared";
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

  initialProcessing: boolean | null;
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
  initialProcessing: false,
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
};
