import type { GlobalStep } from "@/shared/schemes/layout-global-step";
import type { RowObject } from "@/shared/schemes/row-object";
import type {
  GlobalStepsEngineModuleOptions,
  IGlobalStepsEngineModule,
} from "../i-global-steps-engine-module";
import type { LoggerModule } from "@/core/logger/logger-native/main";
import type { GlobalStepTransform } from "@/shared/schemes/global-step-transform";
import type { GlobalStepValidator } from "@/shared/schemes/global-step-validator";
import type { ValidationError } from "@/shared/schemes/local-step-validators";
import type { Signal } from "@preact/signals-core";
import { signal } from "@preact/signals-core";
import { yieldControl } from "@/shared";

export class GlobalStepsEngineModule implements IGlobalStepsEngineModule {
  private id: string = "global-steps-engine";
  private logger: LoggerModule;
  private options: GlobalStepsEngineModuleOptions;
  progress = signal<number | null>(null);

  constructor(logger: LoggerModule, options: GlobalStepsEngineModuleOptions) {
    this.logger = logger;
    this.logger.log("GlobalStepsEngineModule initialized", "debug", "constructor", this.id);
    this.options = options;
  }

  handleStep = (
    stream: ReadableStream<{ rows: RowObject[] }>,
    step: GlobalStep,
    totalRowsEstimated: Signal<number | null>,
    signal?: AbortSignal
  ): ReadableStream<{ rows: RowObject[]; errors: ValidationError[]; removedErrors: number[] }> => {
    signal?.throwIfAborted();

    this.progress.value = 0;
    let totalRowsProcessed = 0;
    const transformer = new TransformStream<
      { rows: RowObject[] },
      { rows: RowObject[]; errors: ValidationError[]; removedErrors: number[] }
    >({
      transform: async ({ rows }, controller) => {
        signal?.throwIfAborted();

        const resultStream = await this.processStep(rows, step, signal);

        totalRowsProcessed += rows.length;
        controller.enqueue(resultStream);

        if (totalRowsEstimated !== null) {
          this.progress.value = Math.round(
            (totalRowsProcessed / (totalRowsEstimated?.value ?? 0)) * 100
          );
        } else {
          this.progress.value = null;
        }

        await yieldControl();
      },
      flush: async () => {
        this.progress.value = null;
      },
    });

    return stream.pipeThrough(transformer);
  };

  private async processStep(
    rows: RowObject[],
    step: GlobalStep,
    signal?: AbortSignal
  ): Promise<{ rows: RowObject[]; errors: ValidationError[]; removedErrors: number[] }> {
    signal?.throwIfAborted();

    const rowsWithoutErrors = rows.filter((row) => !row.__isError);

    const errors: ValidationError[] = [];
    const removedErrors: number[] = [];

    for (const order of step.order) {
      signal?.throwIfAborted();

      if (order === "transforms") {
        for (const transform of step.transforms || []) {
          await this.executeTransform(rowsWithoutErrors, transform, signal);
        }
      } else if (order === "validators") {
        for (const validator of step.validators || []) {
          const { validationErrors, removedValidationErrors } = await this.executeValidator(
            rowsWithoutErrors,
            validator,
            signal
          );
          errors.push(...validationErrors);
          removedErrors.push(...removedValidationErrors);
        }
      }
    }

    return { rows, errors, removedErrors };
  }

  private async executeValidator(
    rows: RowObject[],
    validator: GlobalStepValidator,
    signal?: AbortSignal
  ): Promise<{ validationErrors: ValidationError[]; removedValidationErrors: number[] }> {
    signal?.throwIfAborted();

    const result = await validator.fn(rows, ...(validator.args || []));

    if (validator.errorCode) {
      result.validationErrors.forEach((e) => (e.validationCode = validator.errorCode!));
    }

    result.removedValidationErrors.forEach((removedValidationError) => {
      rows[removedValidationError].__isError = undefined;
    });

    result.validationErrors.forEach((validationError) => {
      rows[validationError.__rowId].__isError =
        `${validationError.headerKey}:${validationError.validationCode}`;
    });

    return {
      validationErrors: result.validationErrors,
      removedValidationErrors: result.removedValidationErrors,
    };
  }

  private async executeTransform(
    rows: RowObject[],
    transform: GlobalStepTransform,
    signal?: AbortSignal
  ): Promise<void> {
    signal?.throwIfAborted();
    await transform.fn(rows, ...(transform.args || []));
  }

  updateOptions(options: Partial<GlobalStepsEngineModuleOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
