import { GlobalStep } from "@/shared/schemes/layout-global-step";
import { RowObject } from "@/shared/schemes/row-object";
import { GlobalStepTransform } from "@/shared/schemes/global-step-transform";
import { GlobalStepValidator } from "@/shared/schemes/global-step-validator";
import { ValidationError } from "@/shared/schemes/local-step-validators";
import { IPersistenceModule } from "../persistence/i-persistence-module";
import { LayoutBase } from "@/shared/schemes/layout-base";
import { Signal } from "@preact/signals-core";

export type GlobalStepsEngineModuleOptions = {
};

export interface IGlobalStepsEngineModule {
    
    getProgress: () => Signal<number|null>;
    
    handleSteps: (
        layout: LayoutBase,
        options?: GlobalStepsEngineModuleOptions,
        signal?: AbortSignal
    ) => Promise<void>;
    
    handleStepTransform: (
        step: GlobalStep,
        transform: GlobalStepTransform,
        signal?: AbortSignal,
        sourceStream?: ReadableStream<{rows: RowObject[]}>
    ) => Promise<ReadableStream<{rows: RowObject[]}>>;
    
    handleStepValidator: (
        step: GlobalStep,
        validator: GlobalStepValidator,
        state: {errors: ValidationError[], removedErrors: number[]},
        signal?: AbortSignal,
        sourceStream?: ReadableStream<{rows: RowObject[]}>
    ) => Promise<ReadableStream<{errors: ValidationError[], removedErrors: number[], rows: RowObject[]}>>;
    
    handleStep: (
        stream: ReadableStream<{ rows: RowObject[] }>,
        step: GlobalStep,
        totalRowsEstimated: number | null,
        signal?: AbortSignal
    ) => ReadableStream<{ rows: RowObject[], errors: ValidationError[], removedErrors: number[] }>;
}