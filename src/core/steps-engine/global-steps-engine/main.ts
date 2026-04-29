import { GlobalStep } from "@/shared/schemes/layout-global-step";
import { RowObject } from "@/shared/schemes/row-object";
import { GlobalStepsEngineModuleOptions, IGlobalStepsEngineModule } from "../i-global-steps-engine-module";
import { LoggerModule } from "@/core/logger/logger-native/main";
import { GlobalStepTransform } from "@/shared/schemes/global-step-transform";
import { GlobalStepValidator } from "@/shared/schemes/global-step-validator";
import { ValidationError } from "@/shared/schemes/local-step-validators";
import { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import { LayoutBase } from "@/shared/schemes/layout-base";
import { Signal } from "@preact/signals-core";


export class GlobalStepsEngineModule implements IGlobalStepsEngineModule {

    private id: string = 'global-steps-engine';
    private logger: LoggerModule;
    private persistenceModule: IPersistenceModule;
    private progress = new Signal<number|null>(null);


    constructor(logger: LoggerModule, persistenceModule: IPersistenceModule) {
        this.logger = logger;
        this.persistenceModule = persistenceModule;
        this.logger.log('GlobalStepsEngineModule initialized', 'debug', 'constructor', this.id);
    }

    getProgress = () => this.progress;

    handleSteps = async (layout: LayoutBase, options?: GlobalStepsEngineModuleOptions, signal?: AbortSignal): Promise<void> => {
        try {
            this.handleAbortSignal(signal);
            
            this.logger.updateStatus({
                order: 1,
                progress: 0,
                status: 'running',
                step: 'handleSteps'
            });

            for (const step of layout.globalSteps || []) {
                this.handleAbortSignal(signal);

                const transformsStream = await this.handleTransforms(step, signal);
                const validatorsStream = await this.handleValidators(step, transformsStream, signal);
                await this.saveValidationResult(validatorsStream);
            }

            this.logger.updateStatus({
                progress: 100,
                status: 'completed'
            });
        } catch (error) {
            this.logger.log(
                `Error in handleSteps: ${error instanceof Error ? error.message : String(error)}`,
                'error',
                'handleSteps',
                this.id
            );
            throw error;
        }
    };

    private async handleTransforms(step: GlobalStep, signal?: AbortSignal): Promise<ReadableStream<{rows: RowObject[]}>> {
        this.handleAbortSignal(signal);

        let sourceStream = step.filter.rowsFilter({} as any);

        for (const transform of step.transforms || []) {
            sourceStream = await this.handleStepTransform(step, transform, signal, sourceStream);
        }

        return sourceStream;
    }

    private async handleValidators(
        step: GlobalStep,
        sourceStream: ReadableStream<{rows: RowObject[]}>,
        signal?: AbortSignal
    ): Promise<ReadableStream<{errors: ValidationError[], removedErrors: number[], rows: RowObject[]}>> {
        this.handleAbortSignal(signal);

        let resultStream = sourceStream as any;
        const state = { errors: [], removedErrors: [] };

        for (const validator of step.validators || []) {
            resultStream = await this.handleStepValidator(step, validator, state, signal, resultStream);
        }

        return resultStream;
    }
    
    handleStepTransform = async (
        step: GlobalStep,
        transform: GlobalStepTransform,
        signal?: AbortSignal,
        sourceStream?: ReadableStream<{rows: RowObject[]}>
    ): Promise<ReadableStream<{rows: RowObject[]}>> => {
        this.handleAbortSignal(signal);

        this.logger.log(
            `Handling step transform: ${transform.name}`,
            'debug',
            'handleStepTransform',
            this.id
        );

        const stream = sourceStream || step.filter.rowsFilter({} as any);

        const transformer = new TransformStream<{rows: RowObject[]}, {rows: RowObject[]}>({
            transform: async ({rows}, controller) => {
                this.handleAbortSignal(signal);
                await transform.fn({rows}, ...transform.args);
                controller.enqueue({rows});
            },
            flush: async () => {
                this.logger.updateStatus({
                    progress: 100,
                    status: 'completed'
                });
            }
        });

        return stream.pipeThrough(transformer);
    };

    handleStepValidator = async (
        step: GlobalStep,
        validator: GlobalStepValidator,
        state: {errors: ValidationError[], removedErrors: number[]},
        signal?: AbortSignal,
        sourceStream?: ReadableStream<{rows: RowObject[]}>
    ): Promise<ReadableStream<{errors: ValidationError[], removedErrors: number[], rows: RowObject[]}>> => {
        this.handleAbortSignal(signal);

        this.logger.log(
            `Handling step validator: ${validator.name}`,
            'debug',
            'handleStepValidator',
            this.id
        );

        const stream = sourceStream || step.filter.rowsFilter({} as any);

        const transformer = new TransformStream<{rows: RowObject[]}, {errors: ValidationError[], removedErrors: number[], rows: RowObject[]}>({
            transform: async ({rows}, controller) => {
                this.handleAbortSignal(signal);
                const result = await validator.fn({rows}, ...validator.args);
                state.errors.push(...result.validationErrors);
                state.removedErrors.push(...result.removedValidationErrors);
                controller.enqueue({
                    rows,
                    errors: result.validationErrors,
                    removedErrors: result.removedValidationErrors
                });
            },
            flush: async () => {
                this.logger.updateStatus({
                    progress: 100,
                    status: 'completed'
                });
            }
        });

        return stream.pipeThrough(transformer);
    };

    private saveValidationResult = async (stream: ReadableStream<{errors: ValidationError[], removedErrors: number[], rows: RowObject[]}>): Promise<void> => {
        const reader = stream.getReader();

        const rowsToSave: RowObject[] = [];
        const allErrors: ValidationError[] = [];
        const allRemovedErrors: number[] = [];

        try {
            while (true) {
                const {done, value} = await reader.read();
                if (done) break;

                if (value.rows) {
                    rowsToSave.push(...value.rows);
                }
                if (value.errors) {
                    allErrors.push(...value.errors);
                }
                if (value.removedErrors) {
                    allRemovedErrors.push(...value.removedErrors);
                }
            }

            const rowsWithErrors = rowsToSave.map(row => {
                const errorForRow = allErrors.find(e => e.__rowId === row.__rowId);
                return errorForRow ? {...row, __sError: errorForRow} : row;
            });

            const streamToSave = new ReadableStream({
                start(controller) {
                    rowsWithErrors.forEach(row => controller.enqueue({rows: [row]}));
                    controller.close();
                }
            });

            await this.persistenceModule.saveStream(streamToSave);

            if (allRemovedErrors.length > 0) {
                await this.persistenceModule.deleteRows(allRemovedErrors);
            }
        } finally {
            reader.releaseLock();
        }
    };

    private handleAbortSignal = (signal?: AbortSignal): void => {
        signal?.throwIfAborted();
    };
    
    handleStep = (stream: ReadableStream<{rows: RowObject[]}>, step: GlobalStep, totalRowsEstimated: number | null, signal?: AbortSignal): ReadableStream<{rows: RowObject[], errors: ValidationError[], removedErrors: number[]}> => {
        signal?.throwIfAborted();
        
        this.progress.value = 0;
        let totalRowsProcessed = 0;
        const transformer = new TransformStream<{rows: RowObject[]}, {rows: RowObject[], errors: ValidationError[], removedErrors: number[]}>({
            transform: async ({rows}, controller) => {
                signal?.throwIfAborted();

                const resultStream = await this.processStep(rows, step, signal);
                
                totalRowsProcessed += rows.length;
                controller.enqueue(resultStream);

                if (totalRowsEstimated !== null) {
                    this.progress.value = Math.round((totalRowsProcessed / totalRowsEstimated) * 100);
                } else {
                    this.progress.value = null;
                }
            },
            flush: async () => {
                this.progress.value = null;
            }
        });

        return stream.pipeThrough(transformer);
    }


    private async processStep(rows: RowObject[], step: GlobalStep, signal?: AbortSignal): Promise<{rows: RowObject[], errors: ValidationError[], removedErrors: number[]}>  {
        signal?.throwIfAborted();

        const rowsWithoutErrors = rows.filter(row => !row.__sError);

        let errors: ValidationError[] = [];
        let removedErrors: number[] = [];

        for (const order of step.order) {
            signal?.throwIfAborted();

            if (order === 'transforms') {
                for (const transform of step.transforms || []) {
                    await this.executeTransform(rowsWithoutErrors, transform, signal);
                }
            } else if (order === 'validators') {
                for (const validator of step.validators || []) {
                    const {validationErrors, removedValidationErrors} = await this.executeValidator(rowsWithoutErrors, validator, signal);
                    errors.push(...validationErrors);
                    removedErrors.push(...removedValidationErrors);
                }
            }
        }

        return {rows, errors, removedErrors};
    }

    private async executeValidator(rows: RowObject[], validator: GlobalStepValidator, signal?: AbortSignal): Promise<{validationErrors: ValidationError[], removedValidationErrors: number[]}> {
        signal?.throwIfAborted();
        const result = await validator.fn({rows}, ...validator.args);
        return {validationErrors: result.validationErrors, removedValidationErrors: result.removedValidationErrors};
    }

    private async executeTransform(rows: RowObject[], transform: GlobalStepTransform, signal?: AbortSignal): Promise<void> {
        signal?.throwIfAborted();
        await transform.fn({rows}, ...transform.args);        
    }


}