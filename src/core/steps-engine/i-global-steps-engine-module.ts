import { GlobalStep } from "@/shared/schemes/layout-global-step";
import { RowObject } from "@/shared/schemes/row-object";
import { GlobalStepTransform } from "@/shared/schemes/global-step-transform";
import { GlobalStepValidator } from "@/shared/schemes/global-step-validator";
import { ValidationError } from "@/shared/schemes/local-step-validators";
import { IPersistenceModule } from "../persistence/i-persistence-module";
import { Signal } from "@preact/signals-core";

export type GlobalStepsEngineModuleOptions = {
};

export interface IGlobalStepsEngineModule {
    
    getProgress: () => Signal<number|null>;
    handleStep: (
        stream: ReadableStream<{ rows: RowObject[] }>,
        step: GlobalStep,
        totalRowsEstimated: number | null,
        signal?: AbortSignal
    ) => ReadableStream<{ rows: RowObject[], errors: ValidationError[], removedErrors: number[] }>;
}