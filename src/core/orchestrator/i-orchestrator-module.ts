import type { OrchestatorContext } from "./schemes/orchestator-context";
import type { OrchestatorStateType } from "./schemes/orchestator-states";
import type { LayoutBase } from "@/shared/schemes/layout-base";
import type { Log } from "@/shared/schemes/log";
import type { Observable } from "rxjs";
import type { Signal } from "@preact/signals-core";
import type { ProviderModule } from "../provider/main";

export interface IOrchestratorModule {
  initialize(provider: ProviderModule, id?: string): void;

  /* layout management */
  setLayout: (layout: LayoutBase) => void;
  getLayout: () => LayoutBase | null;

  /* identity / state / context */
  getId(): string;
  getCurrentState(): string;
  getCurrentContext(): OrchestatorContext;

  /* reactive observables exposed by the module */
  progress$: Observable<{ label: string; value: number | null }[]>;
  state$: Observable<OrchestatorStateType>;
  context$: Observable<OrchestatorContext>;
  metrics$: Observable<OrchestatorContext["metrics"]>;
  logs$: Observable<Log>;
  /* raw signals (for consumers that use Preact signals) */
  stateSignal: Signal<OrchestatorStateType>;
  metricsSignal: Signal<OrchestatorContext["metrics"]>;

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
