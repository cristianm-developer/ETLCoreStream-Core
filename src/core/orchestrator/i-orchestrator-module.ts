import type { OrchestratorContext } from "./schemes/orchestrator-context";
import type { OrchestratorStateType } from "./schemes/orchestrator-states";
import type { LayoutBase } from "@/shared/schemes/layout-base";
import type { Log } from "@/shared/schemes/log";
import type { Observable } from "rxjs";
import type { Signal } from "@preact/signals-core";
import type { ProviderModule } from "../provider/main";

export interface IOrchestratorModule {
  initialize(provider: ProviderModule, id?: string): void;

  /* layout management */
  getLayout: () => LayoutBase | null;

  /* identity / state / context */
  getId(): string;
  getCurrentState(): string;
  getCurrentContext(): OrchestratorContext;

  /* reactive observables exposed by the module */
  progress$: Observable<{ label: string; value: number | null }[]>;
  state$: Observable<OrchestratorStateType>;
  context$: Observable<OrchestratorContext>;
  metrics$: Observable<OrchestratorContext["metrics"]>;
  logs$: Observable<Log>;
  file$: Observable<File | null>;
  /* raw signals (for consumers that use Preact signals) */
  stateSignal: Signal<OrchestratorStateType>;
  metricsSignal: Signal<OrchestratorContext["metrics"]>;

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
  changePage(pageNumber: number): void;
  removeRow(rowId: number): void;
  export(id: string, target: "Stream" | "File"): void;
  editRow(rowId: number, key: string, value: string): void;

  /* utilities */
  cleanPersistence(): void;
}
