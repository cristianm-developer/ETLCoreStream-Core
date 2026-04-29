import { LayoutBase } from "@/shared/schemes/layout-base";
import { LoggerModule } from "../../logger/logger-native/main";
import { Transform } from "node:stream";
import { RowObject } from "@/shared/schemes/row-object";
import { LayoutLocalStep } from "@/shared/schemes/layout-local-step";
import { LocalStepTransform } from "@/shared/schemes/local-step-transforms";
import { error } from "node:console";
import { LocalStepValidator, ValidationError } from "@/shared/schemes/local-step-validators";
import { ILocalStepsEngineModule, LocalStepsEngineModuleOptions, DEFAULT_STEPS_ENGINE_OPTIONS } from "../i-local-steps-engine-module";


export type { LocalStepsEngineModuleOptions as StepsEngineModuleOptions };
export { DEFAULT_STEPS_ENGINE_OPTIONS };

export class LocalStepsEngineModule implements ILocalStepsEngineModule {

    private id: string = 'steps-engine';
    private options: LocalStepsEngineModuleOptions;
    private logger: LoggerModule;

    constructor( logger: LoggerModule, options: LocalStepsEngineModuleOptions) {
        this.options = { ...DEFAULT_STEPS_ENGINE_OPTIONS, ...options };
        this.logger = logger;
        this.logger.log('LocalStepsEngineModule initialized', 'debug', 'constructor', this.id);
    }

    handleStream = async (stream: ReadableStream, layout: LayoutBase, signal?: AbortSignal, step: string = 'steps-engine', order: number = 2) => {
        this.logger.log('Handling stream', 'debug', step, this.id);
        this.logger.updateStatus({ order, progress: 0, status: 'running', step });

        let errorCount = {count : 0};
        let errorDicc: Record<string, ValidationError> = {};

        let transformer = new TransformStream({
            transform: async (chunk, controller) => {
                try {
                    
                    const { rows, progress, bytesProcessed, totalRowsCount } = chunk;
                    const rowCount = rows.length;
                    this.handleAbortSignal(signal);
    
                    for (let i = 0; i < rowCount; i++) {
    
                        const row = rows[i] as RowObject;
                        const steps = layout.localSteps;
    
                        if(row.__sError){
                            this.logger.log(`Row ${row.__rowId} is error, skipping`, 'debug', 'handleStream', this.id);
                            continue;
                        }
    
                        if(this.options.maxErrorCount > 0 && errorCount.count >= this.options.maxErrorCount){
                            this.logger.log(`Max error count reached, skipping`, 'debug', 'handleStream', this.id);
                            throw new Error('Max error count reached');
                        }
    
                        for (const step of steps) {
                            this.handleStep(step, row, errorCount, signal, errorDicc);
                        }
                            
                    }

                    controller.enqueue({ rows, errorDicc, errorCount, progress, bytesProcessed, totalRowsCount, metrics: chunk.metrics });

                } catch (error) {
                    this.logger.log(`Error in steps engine`, 'error', 'handleStream', this.id);
                    this.logger.updateStatus({ order: 99, progress: 0, status: 'error', step: 'steps-engine' });
                    controller.error(error);
                }
                
                
            },
            flush: async () => {
                this.logger.log('Flushing steps engine', 'debug', 'handleStream', this.id);
                this.logger.updateStatus({
                    order: order,
                    progress: 100,
                    status: 'completed',
                    step: 'steps-engine'
                });
            }
        })

        return stream.pipeThrough(transformer);

    }

    
    handleStep = (step: LayoutLocalStep, row: RowObject, errorCount: {count: number}, signal?: AbortSignal, errorDicc: Record<string, ValidationError> = {}) => {
        const { order } = step;

        const executionFn = {
            validators: this.executeValidators,
            transforms: this.executeTransforms,
        }

        if(row.__sError){
            this.logger.log(`Row ${row.__rowId} is error, skipping step ${step.name}`, 'debug', 'handleStep', this.id);
            return;
        }

        for (const next of order) {
            this.handleAbortSignal(signal);            
            executionFn[next]?.({step, row, signal, errorDicc, errorCount});
        }
        
    }

    executeValidators = ({step, row, signal, errorDicc, errorCount}: {errorDicc: Record<string, ValidationError>, step: LayoutLocalStep, row: RowObject, errorCount: {count: number}, signal?: AbortSignal}) => {

        this.logger.log(`Executing validators for step ${step.name}`, 'debug', 'executeValidators', this.id);
        
        this.handleAbortSignal(signal);

        const { validators } = step;
        let rowId = row.__rowId;        

        for (const validator of validators) {
            this.handleAbortSignal(signal);

            const { headerKey, fn, args } = validator;
            const cellValue = row.value[headerKey];

            try {

                const result = fn(cellValue, row, ...args);
    
                if(!result.isValid){
                    errorDicc[rowId] = {
                        __rowId: rowId,
                        headerKey,
                        validationCode: result.validationCode,
                        message: result.message,
                        value: cellValue,
                        originalValue: row.__originalValue[headerKey],
                        step: step.name,
                    }
                    row.__sError = result.validationCode;
                    errorCount.count++;
                    break;
                }
            } catch (error) {

                errorDicc[rowId] = {
                    __rowId: rowId,
                    headerKey,
                    validationCode: `UNEXPECTED_ERROR - ${validator.headerKey}:${validator.name}`,
                    message: error.message,
                    value: cellValue,
                    originalValue: row.__originalValue[headerKey],
                    step: step.name,
                }
                errorCount.count++;
                row.__sError = `UNEXPECTED_ERROR - ${validator.headerKey}:${validator.name}`;

                this.logger.log(`Unexpected error in validator ${validator.headerKey}:${validator.name}`, 'error', 'executeValidators', this.id);
                this.logger.updateStatus({ order: 99, progress: 0, status: 'error', step: step.name });
                throw error;
            }
        }
    }

    executeTransforms = ({step, row, signal}: {step: LayoutLocalStep, row: RowObject, signal?: AbortSignal}) => {

        this.handleAbortSignal(signal);
        this.logger.log(`Executing transforms for step ${step.name}`, 'debug', 'executeTransforms', this.id);

        const { transforms } = step;
        for (const transform of transforms) {
            this.handleAbortSignal(signal);
            const { headerKey, fn, args } = transform;

            try {

                const cellValue = row.value[headerKey];
                const result = fn(cellValue, row, ...args);
                row.value[headerKey] = result;
            } catch (error) {
                throw new Error(`Unexpected error in transform ${transform.headerKey}:${transform.name}`);
            }
        }
    }
    
    handleAbortSignal = (signal?: AbortSignal) => {
        if (signal?.aborted) {
            throw new Error('Abort signal received');
        }
    }

    executeSingleRow = async (row: RowObject, layout: LayoutBase, signal?: AbortSignal): Promise<any> => {
        try {
            this.handleAbortSignal(signal);
            
            if (!row || row.__sError) {
                this.logger.log(
                    `Cannot execute single row: row is null or has __sError`,
                    'warn',
                    'executeSingleRow',
                    this.id
                );
                return {
                    success: false,
                    row,
                    error: 'Row is null or has error flag'
                };
            }

            const steps = layout.localSteps;
            let errorCount = { count: 0 };
            let errorDicc: Record<string, ValidationError> = {};

            this.logger.log(
                `Executing local steps for single row ${row.__rowId}`,
                'debug',
                'executeSingleRow',
                this.id
            );

            for (const step of steps) {
                this.handleAbortSignal(signal);
                
                if (row.__sError) {
                    this.logger.log(
                        `Row ${row.__rowId} marked as error, stopping step execution`,
                        'debug',
                        'executeSingleRow',
                        this.id
                    );
                    break;
                }

                this.handleStep(step, row, errorCount, signal, errorDicc);
            }

            const validationErrors = Object.values(errorDicc);
            this.logger.log(
                `Single row execution completed: errors=${validationErrors.length}, errorCount=${errorCount.count}`,
                'debug',
                'executeSingleRow',
                this.id
            );

            return {
                success: errorCount.count === 0,
                row,
                validationErrors,
                errorCount: errorCount.count
            };
        } catch (error) {
            this.logger.log(
                `Error executing single row: ${error.message}`,
                'error',
                'executeSingleRow',
                this.id
            );
            return {
                success: false,
                row,
                validationErrors: [],
                error: error.message
            };
        }
    }
}