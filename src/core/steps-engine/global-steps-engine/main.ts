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
        const result = await validator.fn(rows, ...validator.args);
        return {validationErrors: result.validationErrors, removedValidationErrors: result.removedValidationErrors};
    }

    private async executeTransform(rows: RowObject[], transform: GlobalStepTransform, signal?: AbortSignal): Promise<void> {
        signal?.throwIfAborted();
        await transform.fn(rows, ...transform.args);        
    }


}