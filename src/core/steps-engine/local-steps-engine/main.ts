import type { LayoutBase } from "@/shared/schemes/layout-base";
import type { LoggerModule } from "../../logger/logger-native/main";
import type { RowObject } from "@/shared/schemes/row-object";
import type { LayoutLocalStep } from "@/shared/schemes/layout-local-step";
import type { ValidationError } from "@/shared/schemes/local-step-validators";
import type {
  ILocalStepsEngineModule,
  LocalStepsEngineModuleOptions,
} from "../i-local-steps-engine-module";
import { DEFAULT_STEPS_ENGINE_OPTIONS } from "../i-local-steps-engine-module";
import type { Signal } from "@preact/signals-core";
import { signal } from "@preact/signals-core";
import { yieldControl } from "@/shared";

export type { LocalStepsEngineModuleOptions as StepsEngineModuleOptions };
export { DEFAULT_STEPS_ENGINE_OPTIONS };

export class LocalStepsEngineModule implements ILocalStepsEngineModule {
  private id: string = "steps-engine";
  private options: LocalStepsEngineModuleOptions;
  private logger: LoggerModule;

  progress = signal<number | null>(null);

  constructor(logger: LoggerModule, options: LocalStepsEngineModuleOptions) {
    this.options = { ...DEFAULT_STEPS_ENGINE_OPTIONS, ...options };
    this.logger = logger;
    this.logger.log("LocalStepsEngineModule initialized", "debug", "constructor", this.id);
  }

  getProgress = () => this.progress;

  handleStream = (
    stream: ReadableStream,
    layout: LayoutBase,
    totalRowEstimated: Signal<number | null>,
    signal?: AbortSignal,
    step: string = "steps-engine",
    order: number = 2
  ) => {
    this.logger.log("Handling stream", "debug", step, this.id);
    this.logger.updateStatus({ order, progress: 0, status: "running", step });

    const errorCount = { count: 0 };
    const errorDicc: Record<number, ValidationError> = {};

    let totalRowsProcessed = 0;
    let lastProgress = 0;

    this.progress.value = 0;

    const transformer = new TransformStream({
      transform: async (chunk, controller) => {
        try {
          const { rows, progress, bytesProcessed, totalRowsCount } = chunk;
          const rowCount = rows.length;
          this.handleAbortSignal(signal);

          for (let i = 0; i < rowCount; i++) {
            totalRowsProcessed++;

            const row = rows[i] as RowObject;
            const steps = layout.localSteps;

            const currentProgress = Math.round(
              (totalRowsCount / (totalRowEstimated?.value ?? 0)) * 100
            );
            const rounded = Math.floor(currentProgress / 5) * 5;
            if (rounded > lastProgress) {
              lastProgress = rounded;
              this.progress.value = Math.min(Number(currentProgress.toFixed(2)), 100);
            }

            if (row.__isError) {
              this.logger.log(
                `Row ${row.__rowId} is error, skipping`,
                "debug",
                "handleStream",
                this.id
              );
              continue;
            }

            if (
              this.options?.maxErrorCount &&
              this.options.maxErrorCount > 0 &&
              errorCount.count >= this.options.maxErrorCount
            ) {
              this.logger.log(
                `Max error count reached, skipping`,
                "debug",
                "handleStream",
                this.id
              );
              throw new Error("Max error count reached");
            }

            for (const step of steps) {
              this.handleStep(step, row, errorCount, signal, errorDicc);
            }

            await yieldControl();
          }

          controller.enqueue({
            rows,
            errorDicc,
            errorCount,
            progress,
            bytesProcessed,
            totalRowsCount,
            metrics: chunk.metrics,
          });
        } catch (error) {
          this.logger.log(
            `Error in steps engine - ` + (error as Error).message,
            "error",
            step,
            this.id
          );
          this.logger.updateStatus({
            order: 99,
            progress: 0,
            status: "error",
            step: "steps-engine",
          });
          controller.error(error);
        }
      },
      flush: async () => {
        this.logger.log("Flushing steps engine", "debug", "handleStream", this.id);
        this.logger.updateStatus({
          order: order,
          progress: 100,
          status: "completed",
          step: "steps-engine",
        });
        this.progress.value = null;
      },
    });

    return stream.pipeThrough(transformer);
  };

  handleStep = (
    step: LayoutLocalStep,
    row: RowObject,
    errorCount: { count: number },
    signal?: AbortSignal,
    errorDicc: Record<number, ValidationError> = {}
  ) => {
    const { order } = step;

    const executionFn = {
      validators: this.executeValidators,
      transforms: this.executeTransforms,
    };

    if (row.__isError) {
      this.logger.log(
        `Row ${row.__rowId} is error, skipping step ${step.name}`,
        "debug",
        "handleStep",
        this.id
      );
      return;
    }

    for (const next of order) {
      this.handleAbortSignal(signal);
      if (row.__isError) {
        this.logger.log(
          `Row ${row.__rowId} is error, skipping step ${step.name}`,
          "debug",
          "handleStep",
          this.id
        );
        continue;
      }
      (executionFn as any)[next]?.({ step, row, signal, errorDicc, errorCount });
    }
  };

  executeValidators = ({
    step,
    row,
    signal,
    errorDicc,
    errorCount,
  }: {
    errorDicc: Record<string, ValidationError>;
    step: LayoutLocalStep;
    row: RowObject;
    errorCount: { count: number };
    signal?: AbortSignal;
  }) => {
    this.handleAbortSignal(signal);

    const { validators } = step;
    const rowId = row.__rowId;

    if (validators) {
      for (const validator of validators) {
        this.handleAbortSignal(signal);

        const { headerKey, fn, args = [], errorCode } = validator;
        const cellValue = row.value[headerKey];

        try {
          const result = fn(cellValue, row, ...args);

          if (!result.isValid) {
            errorDicc[rowId] = {
              __rowId: rowId,
              headerKey,
              validationCode: errorCode || result.validationCode,
              message: result.message,
              value: cellValue,
              originalValue: row.__originalValue?.[headerKey],
              step: step.name,
            };
            row.__isError = `${validator.headerKey}:${errorCode || result.validationCode}`;
            errorCount.count++;
            break;
          }
        } catch (error) {
          errorDicc[rowId] = {
            __rowId: rowId,
            headerKey,
            validationCode: `UNEXPECTED_ERROR - ${validator.headerKey}:${validator.name}`,
            message: (error as Error).message,
            value: cellValue,
            originalValue: row.__originalValue?.[headerKey] ?? undefined,
            step: step.name,
          };
          errorCount.count++;
          row.__isError = `UNEXPECTED_ERROR - ${validator.headerKey}:${validator.name}`;

          this.logger.log(
            `Unexpected error in validator ${validator.headerKey}:${validator.name}`,
            "error",
            "executeValidators",
            this.id
          );
          this.logger.updateStatus({ order: 99, progress: 0, status: "error", step: step.name });
          throw error;
        }
      }
    }
  };

  executeTransforms = ({
    step,
    row,
    signal,
  }: {
    step: LayoutLocalStep;
    row: RowObject;
    signal?: AbortSignal;
  }) => {
    this.handleAbortSignal(signal);

    const { transforms } = step;
    if (transforms) {
      for (const transform of transforms) {
        this.handleAbortSignal(signal);
        const { headerKey, fn, args = [] } = transform;

        try {
          const cellValue = row.value[headerKey];
          const result = fn(cellValue, row, ...args);
          row.value[headerKey] = result;
        } catch (error) {
          throw new Error(
            `Unexpected error in transform ${transform.headerKey}:${transform.name} - ${(error as Error).message}`
          );
        }
      }
    }
  };

  handleAbortSignal = (signal?: AbortSignal) => {
    if (signal?.aborted) {
      throw new Error("Abort signal received");
    }
  };

  executeSingleRow = async (
    row: RowObject,
    layout: LayoutBase,
    signal?: AbortSignal
  ): Promise<any> => {
    try {
      this.handleAbortSignal(signal);

      if (!row || row.__isError) {
        this.logger.log(
          `Cannot execute single row: row is null or has __sError`,
          "warn",
          "executeSingleRow",
          this.id
        );
        return {
          success: false,
          row,
          error: "Row is null or has error flag",
        };
      }

      const steps = layout.localSteps;
      const errorCount = { count: 0 };
      const errorDicc: Record<string, ValidationError> = {};

      this.logger.log(
        `Executing local steps for single row ${row.__rowId}`,
        "debug",
        "executeSingleRow",
        this.id
      );

      for (const step of steps) {
        this.handleAbortSignal(signal);

        if (row.__isError) {
          this.logger.log(
            `Row ${row.__rowId} marked as error, stopping step execution`,
            "debug",
            "executeSingleRow",
            this.id
          );
          break;
        }

        this.handleStep(step, row, errorCount, signal, errorDicc);
      }

      const validationErrors = Object.values(errorDicc);
      this.logger.log(
        `Single row execution completed: errors=${validationErrors.length}, errorCount=${errorCount.count}`,
        "debug",
        "executeSingleRow",
        this.id
      );

      return {
        success: errorCount.count === 0,
        row,
        validationErrors,
        errorCount: errorCount.count,
      };
    } catch (error) {
      this.logger.log(
        `Error executing single row: ${(error as Error).message}`,
        "error",
        "executeSingleRow",
        this.id
      );
      return {
        success: false,
        row,
        validationErrors: [],
        error: (error as Error).message,
      };
    }
  };

  updateOptions(options: Partial<LocalStepsEngineModuleOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
