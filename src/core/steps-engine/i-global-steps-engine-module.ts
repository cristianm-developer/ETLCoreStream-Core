import type { GlobalStep } from "@/shared/schemes/layout-global-step";
import type { RowObject } from "@/shared/schemes/row-object";
import type { ValidationError } from "@/shared/schemes/local-step-validators";
import type { Signal } from "@preact/signals-core";

export type GlobalStepsEngineModuleOptions = {};

export interface IGlobalStepsEngineModule {
  progress: Signal<number | null>;
  handleStep: (
    stream: ReadableStream<{ rows: RowObject[] }>,
    step: GlobalStep,
    totalRowsEstimated: Signal<number | null>,
    signal?: AbortSignal
  ) => ReadableStream<{ rows: RowObject[]; errors: ValidationError[]; removedErrors: number[] }>;
  updateOptions(options: Partial<GlobalStepsEngineModuleOptions>): void;
}
