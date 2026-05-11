import type { LayoutBase } from "@/shared/schemes/layout-base";
import type { Log } from "@/shared/schemes/log";
import type { Observable } from "rxjs";
import type { ProviderModule } from "../provider/main";
import type { Notification } from "@/shared/schemes/notification";
import type { FileMetrics, RowFilter, RowObject } from "@/shared";
import type { ReadonlySignal } from "@preact/signals-core";

export interface IOrchestratorModule {
  initialize(provider: ProviderModule, id?: string): void;

  /* identity / state / context */
  getId(): string;
  getCurrentState(): string;
  getCurrentContext(): any;

  /* reactive observables exposed by the module */
  logs$: Observable<Log>;
  notification$: Observable<Notification | null>;

  //handler for signals access
  layout$: Observable<LayoutBase | null>;
  layout: ReadonlySignal<LayoutBase | null>;
  state$: Observable<any>;
  state: ReadonlySignal<any>;
  metrics$: Observable<FileMetrics | null>;
  metrics: ReadonlySignal<FileMetrics | null>;
  progress$: Observable<{ label: string; value: number | null }[]>;
  progress: ReadonlySignal<{ label: string; value: number | null }[]>;
  file$: Observable<File | null>;
  file: ReadonlySignal<File | null>;
  context$: Observable<any | null>;
  context: ReadonlySignal<any | null>;

  currentRows$: Observable<RowObject[] | null>;
  currentRows: ReadonlySignal<RowObject[] | null>;

  viewPaginationInfo$: Observable<{ currentPage: number | null; totalPages: number | null }>;
  viewPaginationInfo: ReadonlySignal<{
    currentPage: number;
    totalPages: number;
  }>;
  viewFilter$: Observable<RowFilter | null>;
  viewFilter: ReadonlySignal<RowFilter | null>;

  errors$: Observable<{
    unexpected: Error | null;
    expected: Error | null;
  }>;
  errors: ReadonlySignal<{
    unexpected: Error | null;
    expected: Error | null;
  }>;

  step$: Observable<string[]>;
  step: ReadonlySignal<string[]>;

  /* helper to retrieve logs synchronously from the logger */
  getLogs(
    fromTime?: Date,
    toTime?: Date,
    fromIndex?: number,
    toIndex?: number,
    level?: "info" | "warn" | "error" | "debug" | "success",
    step?: string,
    id?: string
  ): Log[];

  /* lifecycle */
  stop(): void;
  reset(): void;

  /* actions available to consumers */
  selectFile(file: File): void;
  selectLayout(layout: LayoutBase): void;

  changeViewFilter(filter: RowFilter | null): void;
  changeViewPage(pageNumber: number): void;
  removeRow(rowId: number): void;
  export(id: string, target: "Stream" | "File"): void;
  editRow(rowId: number, key: string, value: string): void;

  updateConfig(module: string, options: any): void;

  /* utilities */
  cleanPersistence(): void;
}
