import { yieldControl } from "../../../shared/utils/yield";
import type { LoggerModule } from "../../logger/logger-native/main";
import { ValidateLayoutHeaders } from "./core/validate-layout";
import type { LayoutBase } from "../../../shared/schemes/layout-base";
import type { LayoutHeader } from "../../../shared/schemes/layout-header";
import type { IMappingModule, MappingModuleOptions } from "../i-mapping-module";
import { DEFAULT_MAP_HEADERS_OPTIONS } from "../i-mapping-module";
import { Signal } from "@preact/signals-core";

export type { MappingModuleOptions as MapHeadersOptions };
export { DEFAULT_MAP_HEADERS_OPTIONS };

export class MappingModule implements IMappingModule {
  private id: string = "mapping-native";
  private options: MappingModuleOptions;
  private logger: LoggerModule;
  private startTime: number = 0;
  private progressSignal = new Signal<number | null>(null);
  get progress() {
    return this.progressSignal.value;
  }

  constructor(logger: LoggerModule, options?: MappingModuleOptions) {
    this.logger = logger;
    this.options = { ...DEFAULT_MAP_HEADERS_OPTIONS, ...(options ?? {}) };
    this.startTime = Date.now();

    this.logger.log("MappingModule initialized", "debug", "constructor", this.id);
  }


  handleStream = async (
    stream: ReadableStream,
    layout: LayoutBase,
    totalRowEstimated: number,
    signal?: AbortSignal,
    step: string = "mapping",
    order: number = 2
  ) => {
    this.logger.log("Handling stream", "debug", step, this.id);
    this.logger.updateStatus({ order, progress: 0, status: "running", step });

    let isFirstChunk = true;

    let columnMapEntries: [string, string][] = [];
    let rowsWithoutRest = 0;

    let totalRowsCount = 0;

    const transformer = new TransformStream({
      transform: async (chunk, controller) => {
        try {
          const { rows, progress, bytesProcessed, metrics } = chunk;

          if (isFirstChunk && rows.length) {
            const remap = await this.handleRemap(layout, rows[0], signal);
            columnMapEntries = remap!;
            isFirstChunk = false;
          }

          const rowCount = rows.length;
          const mappedRows = new Array(rows.length);
          const mapLen = columnMapEntries.length;

          for (let i = 0; i < rowCount; i++) {
            this.handleAbortSignal(signal, step, this.id);

            const row = rows[i];
            const mapped: { [key: string]: any } = {};
            totalRowsCount++;

            this.progressSignal.value = Math.round((totalRowsCount / totalRowEstimated) * 100);

            for (let j = 0; j < mapLen; j++) {
              const [internalKey, externalKey] = columnMapEntries[j];
              const headerRespective = layout.headers.find((h) => h.key === externalKey);
              mapped[internalKey] = row[externalKey] ?? headerRespective?.default ?? "";
            }

            mappedRows[i] = {
              __rowId: totalRowsCount,
              __originalValue: this.options.preserveOriginalValue
                ? JSON.stringify(mapped)
                : undefined,
              value: mapped,
            };

            rowsWithoutRest++;

            if (this.options.restCount && rowsWithoutRest >= this.options.restCount) {
              await yieldControl();
              rowsWithoutRest = 0;
            }
          }

          controller.enqueue({
            rows: mappedRows,
            progress,
            totalRowsCount,
            bytesProcessed,
            metrics,
          });

          if (progress % 5 === 0) {
            this.logger.updateStatus({ order, progress, status: "running", step });
            this.logger.log(`Processed ${bytesProcessed} bytes`, "debug", step, this.id);
          }
        } catch (error) {
          this.logger.log("Error transforming chunk", "error", step, this.id);
          this.logger.updateStatus({ order, progress: 0, status: "error", step });
          controller.error(error);
        }
      },
      flush: () => {
        this.logger.updateStatus({ order, progress: 100, status: "completed", step });
        this.logger.log("Stream mapping completed", "debug", step, this.id);
        this.progressSignal.value = null;
      },
    });

    return stream.pipeThrough(transformer);
  };

  handleRemap = async (layout: LayoutBase, row: any, signal?: AbortSignal) => {
    this.logger.log("Handling remap", "debug", "handleRemap", this.id);

    const rowKeys: string[] = Object.keys(row);

    const preValidationResult = ValidateLayoutHeaders(layout.headers, row);
    if (this.options.allowRemapColumns) {
      if (this.options.ignoreRemapUnrequired && preValidationResult.isValid) {
        return this.generateMapFromHeaders(layout.headers, row);
      }

      const canBeMapped = rowKeys.length >= layout.headers.filter((e) => e.required).length;
      if (canBeMapped && this.options.onRemapFn) {
        let mapValue: [string, string][] | null = null;
        let attemps = 0;

        this.logger.log("Can be mapped", "debug", "handleRemap", this.id);

        while (!mapValue && attemps < 3) {
          attemps++;
          this.handleAbortSignal(signal, "handleRemap", this.id);
          const result = await this.options.onRemapFn?.(rowKeys, layout.headers);
          if (result) {
            mapValue = result;
          } else {
            this.logger.log(`No map found, attempt ${attemps}`, "debug", "handleRemap", this.id);
          }
        }
        if (!mapValue) {
          this.logger.log("Cannot be mapped", "debug", "handleRemap", this.id);
          throw new Error("Mapping Error: Cannot be mapped");
        }

        return mapValue;
      } else {
        this.logger.log("Cannot be mapped", "debug", "handleRemap", this.id);
        throw new Error("Mapping Error: Cannot be mapped");
      }
    } else {
      if (preValidationResult.isValid) {
        return this.generateMapFromHeaders(layout.headers, row);
      } else {
        throw new Error("Mapping Error: Headers are not valid");
      }
    }
  };

  generateMapFromHeaders = (headers: LayoutHeader[], row: any) => {
    const rowKeys = Object.keys(row);
    const mapEntries: [string, string][] = [];

    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];

      const rowsToValidate = h.caseSensitive
        ? rowKeys.map((key) => [key, key])
        : rowKeys.map((key) => [key, key.toLowerCase()]);

      const availablesHeaders = h.caseSensitive
        ? [h.key, ...h.alternativeKeys]
        : [h.key.toLowerCase(), ...h.alternativeKeys.map((key) => key.toLowerCase())];

      const entry = rowsToValidate.find((k) => availablesHeaders.includes(k[1]));
      if (entry) {
        mapEntries.push([h.key, entry[0]]);
      }
    }

    return mapEntries;
  };

  handleAbortSignal = (
    abortSignal?: AbortSignal,
    step: string = "mapping",
    id: string = "mapping-native"
  ) => {
    if (abortSignal?.aborted) {
      this.logger.log("Abort signal received", "debug", step, id);
      throw new Error("Mapping Error: Abort signal received");
    }
  };
}
