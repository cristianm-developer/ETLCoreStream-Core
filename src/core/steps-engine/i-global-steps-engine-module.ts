import type { GlobalStep } from "@/shared/schemes/layout-global-step";
import type { RowObject } from "@/shared/schemes/row-object";
import type { GlobalStepTransform } from "@/shared/schemes/global-step-transform";
import type { GlobalStepValidator } from "@/shared/schemes/global-step-validator";
import type { ValidationError } from "@/shared/schemes/local-step-validators";
import type { LayoutBase } from "@/shared/schemes/layout-base";
import type { Signal } from "@preact/signals-core";

export type GlobalStepsEngineModuleOptions = {};

export interface IGlobalStepsEngineModule {
  getProgress: () => Signal<number | null>;

  handleSteps: (
    layout: LayoutBase,
    options?: GlobalStepsEngineModuleOptions,
    signal?: AbortSignal
  ) => Promise<void>;

  handleStepTransform: (
    step: GlobalStep,
    transform: GlobalStepTransform,
    signal?: AbortSignal,
    sourceStream?: ReadableStream<{ rows: RowObject[] }>
  ) => Promise<ReadableStream<{ rows: RowObject[] }>>;

  handleStepValidator: (
    step: GlobalStep,
    validator: GlobalStepValidator,
    state: { errors: ValidationError[]; removedErrors: number[] },
    signal?: AbortSignal,
    sourceStream?: ReadableStream<{ rows: RowObject[] }>
  ) => Promise<
    ReadableStream<{ errors: ValidationError[]; removedErrors: number[]; rows: RowObject[] }>
  >;

  handleStep: (
    stream: ReadableStream<{ rows: RowObject[] }>,
    step: GlobalStep,
    totalRowsEstimated: number | null,
    signal?: AbortSignal
  ) => ReadableStream<{ rows: RowObject[]; errors: ValidationError[]; removedErrors: number[] }>;
}
