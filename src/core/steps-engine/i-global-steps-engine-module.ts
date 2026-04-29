import { GlobalStep } from "@/shared/schemes/layout-global-step";
import { RowObject } from "@/shared/schemes/row-object";
import { GlobalStepTransform } from "@/shared/schemes/global-step-transform";
import { GlobalStepValidator } from "@/shared/schemes/global-step-validator";
import { ValidationError } from "@/shared/schemes/local-step-validators";
import { IPersistenceModule } from "../persistence/i-persistence-module";

export type GlobalStepsEngineModuleOptions = {
};

export interface IGlobalStepsEngineModule {
    
    handleStep: (
        step: GlobalStep,
        persistenceModule: IPersistenceModule,
        signal?: AbortSignal,
        rowIds?: number[]
    ) => ReadableStream<{ rows: RowObject[], errors: ValidationError[], removedErrors: number[] }>;
}