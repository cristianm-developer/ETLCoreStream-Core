import { GlobalStep } from "@/shared/schemes/layout-global-step";
import { RowObject } from "@/shared/schemes/row-object";
import { GlobalStepsEngineModuleOptions, IGlobalStepsEngineModule } from "../i-global-steps-engine-module";
import { LoggerModule } from "@/core/logger/logger-native/main";
import { GlobalStepTransform } from "@/shared/schemes/global-step-transform";
import { GlobalStepValidator } from "@/shared/schemes/global-step-validator";
import { ValidationError } from "@/shared/schemes/local-step-validators";
import { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import { LayoutBase } from "@/shared/schemes/layout-base";


export class GlobalStepsEngineModule implements IGlobalStepsEngineModule {

    private id: string = 'global-steps-engine';
    private logger: LoggerModule;
    private persistenceModule: IPersistenceModule;


    constructor(logger: LoggerModule, persistenceModule: IPersistenceModule) {
        this.logger = logger;
        this.persistenceModule = persistenceModule;
        this.logger.log('GlobalStepsEngineModule initialized', 'debug', 'constructor', this.id);
    }
    
    handleStep = (step: GlobalStep, persistenceModule: IPersistenceModule, signal?: AbortSignal, rowIds?: number[]): ReadableStream<{rows: RowObject[], errors: ValidationError[], removedErrors: number[]}> => {
        this.handleAbortSignal(signal);
        return new ReadableStream();
    }

    async handleSteps(layout: LayoutBase, persistenceModule?: IPersistenceModule, signal?: AbortSignal): Promise<void> {
        this.handleAbortSignal(signal);
        if (persistenceModule) {
            this.persistenceModule = persistenceModule;
        }
        
        this.logger?.log(`Processing ${layout.globalSteps.length} global steps`, 'debug', 'handleSteps', this.id);
        this.logger?.updateStatus({
            order: 1,
            progress: 0,
            status: 'running',
            step: 'handleSteps'
        });

        try {
            for (const step of layout.globalSteps) {
                await this.processStep(step, signal);
            }
            this.logger?.log('All steps completed', 'debug', 'handleSteps', this.id);
        } catch (error) {
            this.logger?.log(error.message, 'error', 'handleSteps', this.id);
            throw error;
        }
    }

    private async processStep(step: GlobalStep, signal?: AbortSignal): Promise<void> {
        this.handleAbortSignal(signal);

        for (const order of step.order) {
            if (order === 'transforms') {
                for (const transform of step.transforms || []) {
                    const resultStream = await this.handleStepTransform(step, transform, signal);
                    await this.consumeStream(resultStream);
                }
            } else if (order === 'validators') {
                for (const validator of step.validators || []) {
                    const resultStream = await this.handleStepValidator(step, validator, { errors: [], removedErrors: [] }, signal);
                    await this.saveValidationResult(resultStream);
                }
            }
        }
    }

    private async consumeStream(stream: ReadableStream<any>): Promise<void> {
        const reader = stream.getReader();
        try {
            while (true) {
                const { done } = await reader.read();
                if (done) break;
            }
        } finally {
            reader.releaseLock();
        }
    }

    private handleStepTransform = async (
        step: GlobalStep, 
        transform: GlobalStepTransform, 
        signal?: AbortSignal, 
        sourceStream?: ReadableStream<{rows: RowObject[]}>
    ): Promise<ReadableStream<{rows: RowObject[], errors: ValidationError[], removedErrors: number[]}>> => {
        this.handleAbortSignal(signal);
        this.logger?.log(`Handling step transform: ${transform.name}`, 'debug', 'handleStepTransform', this.id);

        const inputStream = sourceStream || (step.filter as any).rowsFilter({});
        const stepStream = new TransformStream<
            {rows: RowObject[], errors?: ValidationError[], removedErrors?: number[]}, 
            {rows: RowObject[], errors: ValidationError[], removedErrors: number[]}
        >({
            transform: async ({rows, errors, removedErrors}, controller) => {
                this.handleAbortSignal(signal);

                try {
                    await (transform.fn as any)({rows}, ...transform.args);
                    controller.enqueue({
                        rows, 
                        errors: errors ?? [], 
                        removedErrors: removedErrors ?? []
                    });
                } catch (error) {
                    this.logger?.log(error.message, 'error', 'handleStepTransform', this.id);
                    controller.error(error);
                }
            },
            flush: async () => {
                this.logger?.log('Transform step completed', 'debug', 'handleStepTransform', this.id);
                this.logger?.updateStatus({
                    order: 1,
                    progress: 100,
                    status: 'completed',
                    step: 'handleStepTransform'
                });
            }
        });

        return inputStream.pipeThrough(stepStream);
    }

    private handleStepValidator = async (
        step: GlobalStep, 
        validator: GlobalStepValidator,
        errorState: {errors: ValidationError[], removedErrors: number[]},
        signal?: AbortSignal,
        sourceStream?: ReadableStream<{rows: RowObject[]}>
    ): Promise<ReadableStream<{rows: RowObject[], errors: ValidationError[], removedErrors: number[]}>> => {
        this.handleAbortSignal(signal);
        this.logger?.log(`Handling step validator: ${validator.name}`, 'debug', 'handleStepValidator', this.id);

        const inputStream = sourceStream || (step.filter as any).rowsFilter({});
        const stepStream = new TransformStream<
            {rows: RowObject[], errors?: ValidationError[], removedErrors?: number[]}, 
            {rows: RowObject[], errors: ValidationError[], removedErrors: number[]}
        >({
            transform: async ({rows, errors, removedErrors}, controller) => {
                this.handleAbortSignal(signal);

                errors = errors ?? [];
                removedErrors = removedErrors ?? [];

                try {
                    const result = await (validator.fn as any)({rows}, errors, ...validator.args);
                    
                    errors = [...errors, ...result.validationErrors];
                    removedErrors = [...removedErrors, ...result.removedValidationErrors];

                    const updatedRows = rows.map(r => {
                        const error = errors.find(e => e.__rowId === r.__rowId);
                        return {...r, __sError: error ? error.validationCode : null};
                    });

                    controller.enqueue({rows: updatedRows, errors, removedErrors});
                } catch (error) {
                    this.logger?.log(error.message, 'error', 'handleStepValidator', this.id);
                    controller.error(error);
                }
            },
            flush: async () => {
                this.logger?.log('Validator step completed', 'debug', 'handleStepValidator', this.id);
                this.logger?.updateStatus({
                    order: 1,
                    progress: 100,
                    status: 'completed',
                    step: 'handleStepValidator'
                });
            }
        });

        return inputStream.pipeThrough(stepStream);
    }

    private saveValidationResult = async (stream: ReadableStream<{rows: RowObject[], errors: ValidationError[], removedErrors: number[]}>): Promise<void> => {
        const reader = stream.getReader();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                if (value?.rows && value.rows.length > 0) {
                    const rawRows = value.rows;
                    const errorDicc: Record<number, ValidationError> = {};
                    
                    for (const error of value.errors) {
                        errorDicc[error.__rowId] = error;
                    }

                    await this.persistenceModule?.saveStream(
                        new ReadableStream({
                            start(controller) {
                                controller.enqueue({
                                    rawRows,
                                    errorDicc,
                                    metrics: undefined
                                });
                                controller.close();
                            }
                        })
                    );
                }

                if (value?.removedErrors && value.removedErrors.length > 0) {
                    if (this.persistenceModule?.deleteErrors) {
                        await this.persistenceModule.deleteErrors(value.removedErrors);
                    } else if ((this.persistenceModule as any)?.deleteRows) {
                        await (this.persistenceModule as any).deleteRows(value.removedErrors);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    private handleAbortSignal = (signal?: AbortSignal): void => {
        signal?.throwIfAborted();
    }

}