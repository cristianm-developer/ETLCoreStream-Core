import * as Papa from "papaparse";
import type { LoggerModule } from "@core/logger/logger-native/main";
import { validateFile } from "./core/validate-file";
import type {
  IImportFileModule,
  ImportFileModuleOptions,
  StreamControls,
  StreamResult,
} from "../i-import-file-module";
import { DEFAULT_IMPORT_FILE_MODULE_OPTIONS } from "../i-import-file-module";
import { signal, Signal } from "@preact/signals-core";
import { isWorkerSupported } from "@/shared/utils/isWorkerSupported";

export type { ImportFileModuleOptions as StreamConfig, StreamControls, StreamResult };
export { DEFAULT_IMPORT_FILE_MODULE_OPTIONS as DEFAULT_STREAM_CONFIG };

export class ImportFilePapaparseModule implements IImportFileModule {
  id: string = "importFile-papaparse";

  private logger: LoggerModule;
  private config: ImportFileModuleOptions;

  progress = signal<number | null>(null);

  private totalEstimatedRowsSignal = new Signal<number | null>(null);
  get totalEstimatedRows() {
    return this.totalEstimatedRowsSignal;
  }

  constructor(logger: LoggerModule, config: ImportFileModuleOptions = {}) {
    this.logger = logger;
    this.config = { ...DEFAULT_IMPORT_FILE_MODULE_OPTIONS, ...config };

    if (!isWorkerSupported()) {
      this.config.worker = false;
    }

    this.logger.log("ImportFilePapaparseModule initialized", "debug", "constructor", this.id);
  }

  readFileStream = (file: File, signal?: AbortSignal): ReadableStream => {
    const validationResult = validateFile(file, this.config);
    if (validationResult?.isValid) {
      this.progress.value = 0;
      const stream = this.createDataStream(file, signal);
      return stream;
    } else {
      this.logger.log(
        "Validation failed: " + validationResult?.message || "File validation failed",
        "error",
        "readFileStream",
        this.id
      );
      throw new Error(
        "Validation failed: " + validationResult?.message || "File validation failed"
      );
    }
  };

  createDataStream(file: File, signal?: AbortSignal) {
    this.logger.log("Creating data stream", "debug", "createDataStream", this.id);

    this.totalEstimatedRowsSignal.value = 0;

    let totalRowsProcessed = 0;

    let parserInstance: any = null;
    const fileSize = file.size;
    const startTime = Date.now();

    let lastProgress = 0;

    const stream = new ReadableStream({
      start: (controller) => {
        this.logger.log(`Reading file: ${file.name}`, "debug", "createDataStream", this.id);
        this.logger.updateStatus({
          order: 1,
          progress: 0,
          status: "running",
          step: "createDataStream",
        });

        Papa.parse(file, {
          header: true,
          worker: this.config.worker,
          chunkSize: this.config.chunkSize,
          dynamicTyping: false,
          skipEmptyLines: true,
          chunk: async (results, parser) => {
            signal?.throwIfAborted();
            parserInstance = parser;

            parser.pause();

            const bytesRead = results.meta.cursor;

            this.logger.log(
              `Chunk read: ${results.data.length} rows`,
              "debug",
              "createDataStream",
              this.id
            );

            totalRowsProcessed += results.data.length;

            if (results.data.length) {
              const aproxRowSize = bytesRead / totalRowsProcessed;
              this.totalEstimatedRowsSignal.value = Math.floor(fileSize / aproxRowSize);
            }

            const progress = (bytesRead / fileSize) * 100;
            const rounded = Math.floor(progress / 5) * 5;
            if (rounded > lastProgress) {
              lastProgress = rounded;
              this.progress.value = Math.min(Number(progress.toFixed(2)), 100);
            }

            controller.enqueue({
              rows: results.data,
              progress: Math.round(progress * 100) / 100,
              bytesProcessed: bytesRead,
              metrics: {
                fileName: file.name,
                fileSize: file.size,
                startTime: startTime,
              },
            });

            parserInstance?.resume();
          },
          complete: () => {
            this.logger.log("File read complete", "debug", "createDataStream", this.id);
            this.logger.updateStatus({
              order: 1,
              progress: 100,
              status: "completed",
              step: "createDataStream",
            });
            controller.close();
            this.totalEstimatedRowsSignal.value = totalRowsProcessed;
            this.progress.value = null;
          },
          error: (err) => {
            this.logger.log(
              `Error reading file: ${err.message}`,
              "error",
              "importingData",
              this.id
            );

            controller.error(err);
          },
        });
      },
      cancel: () => parserInstance?.abort(),
    });

    signal?.throwIfAborted();

    return stream;
  }

  updateOptions(options: Partial<ImportFileModuleOptions>): void {
    this.config = { ...this.config, ...options };
  }
}
