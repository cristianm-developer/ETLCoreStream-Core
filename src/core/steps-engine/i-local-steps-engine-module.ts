import type { LayoutBase } from "@/shared/schemes/layout-base";
import type { RowObject } from "@/shared/schemes/row-object";
import type { ValidationError } from "@/shared/schemes/local-step-validators";
import type { Signal } from "@preact/signals-core";

export type LocalStepsEngineModuleOptions = {
  maxErrorCount?: number;
  validationCodeDictionary?: Record<string, string>;
};

export const DEFAULT_STEPS_ENGINE_OPTIONS: LocalStepsEngineModuleOptions = {
  maxErrorCount: 0,
};

export type LocalStepResult = {
  success: boolean;
  row: RowObject;
  validationErrors?: ValidationError[];
  error?: string;
};

export interface ILocalStepsEngineModule {
  getProgress: () => Signal<number | null>;

  handleStream: (
    stream: ReadableStream,
    layout: LayoutBase,
    totalRowEstimated: number,
    signal?: AbortSignal,
    step?: string,
    order?: number
  ) => Promise<ReadableStream>;
}
