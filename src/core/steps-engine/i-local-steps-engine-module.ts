import { LayoutBase } from "@/shared/schemes/layout-base";
import { RowObject } from "@/shared/schemes/row-object";
import { ValidationError } from "@/shared/schemes/local-step-validators";
import { LayoutLocalStep } from "@/shared/schemes/layout-local-step";

export type LocalStepsEngineModuleOptions = {
    maxErrorCount?: number;
    validationCodeDictionary?: Record<string, string>;
}

export const DEFAULT_STEPS_ENGINE_OPTIONS: LocalStepsEngineModuleOptions = {
    maxErrorCount: 0,
}

export type LocalStepResult = {
    success: boolean;
    row: RowObject;
    validationErrors?: ValidationError[];
    error?: string;
};

export interface ILocalStepsEngineModule {
    handleStream: (
        stream: ReadableStream,
        layout: LayoutBase,
        signal?: AbortSignal,
        step?: string,
        order?: number
    ) => Promise<ReadableStream>;
    
    handleStep: (
        step: any,
        row: RowObject,
        errorCount: {count: number},
        signal?: AbortSignal,
        errorDicc?: Record<string, ValidationError>
    ) => void;
    
    executeValidators: (config: {
        step: any;
        row: RowObject;
        signal?: AbortSignal;
        errorDicc: Record<string, ValidationError>;
        errorCount: {count: number};
    }) => void;
    
    executeTransforms: (config: {
        step: any;
        row: RowObject;
        signal?: AbortSignal;
    }) => void;
    
    handleAbortSignal: (signal?: AbortSignal) => void;

    executeSingleRow: (
        row: RowObject,
        layout: LayoutBase,
        signal?: AbortSignal
    ) => Promise<LocalStepResult>;
}
