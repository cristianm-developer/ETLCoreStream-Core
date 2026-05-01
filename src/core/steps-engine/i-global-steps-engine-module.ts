import type { GlobalStep } from "@/shared/schemes/layout-global-step";
import type { RowObject } from "@/shared/schemes/row-object";
import type { ValidationError } from "@/shared/schemes/local-step-validators";

export type GlobalStepsEngineModuleOptions = {};

export interface IGlobalStepsEngineModule {
  progress: number | null;
  handleStep: (
    stream: ReadableStream<{ rows: RowObject[] }>,
    step: GlobalStep,
    totalRowsEstimated: number | null,
    signal?: AbortSignal
  ) => ReadableStream<{ rows: RowObject[]; errors: ValidationError[]; removedErrors: number[] }>;
  updateOptions(options: Partial<GlobalStepsEngineModuleOptions>): void;
}
