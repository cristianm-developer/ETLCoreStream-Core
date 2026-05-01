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
import { Signal } from "@preact/signals-core";
import { isWorkerSupported } from "@/shared/utils/isWorkerSupported";

export type { ImportFileModuleOptions as StreamConfig, StreamControls, StreamResult };
export { DEFAULT_IMPORT_FILE_MODULE_OPTIONS as DEFAULT_STREAM_CONFIG };

export class ImportFilePapaparseModule implements IImportFileModule {
  id: string = "importFile-papaparse";

  private logger: LoggerModule;
  private config: ImportFileModuleOptions;

  private progressSignal = new Signal<number | null>(null);

  private totalRowsEstimated = new Signal<number | null>(null);

  constructor(logger: LoggerModule, config: ImportFileModuleOptions = {}) {
    this.logger = logger;
    this.config = { ...DEFAULT_IMPORT_FILE_MODULE_OPTIONS, ...config };

    if (!isWorkerSupported()) {
      this.config.worker = false;
    }

    this.logger.log("ImportFilePapaparseModule initialized", "debug", "constructor", this.id);
  }

  get progress() {
    return this.progressSignal.value;
  }

  readFileStream = (file: File, signal?: AbortSignal): [ReadableStream, Signal<number | null>] => {
    const validationResult = validateFile(file, this.config);
    if (validationResult?.isValid) {
      const stream = this.createDataStream(file, signal);
      return [stream, this.totalRowsEstimated];
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

    this.totalRowsEstimated.value = 0;

    let totalRowsProcessed = 0;

    let parserInstance: any = null;
    const fileSize = file.size;
    const startTime = Date.now();

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
          chunk: (results, parser) => {
            handleAbortSignal(signal, "createDataStream", this.id);
            parserInstance = parser;

            const bytesRead = results.meta.cursor;
            const progress = (bytesRead / fileSize) * 100;

            this.logger.log(
              `Chunk read: ${results.data.length} rows`,
              "debug",
              "createDataStream",
              this.id
            );
            this.logger.updateStatus({
              order: 1,
              progress: Math.round(progress * 100) / 100,
              status: "running",
              step: "createDataStream",
            });

            totalRowsProcessed += results.data.length;

            if (results.data.length) {
              const aproxRowSize = bytesRead / totalRowsProcessed;
              this.totalRowsEstimated.value = Math.floor(fileSize / aproxRowSize);
            }

            this.progressSignal.value = progress;

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

            if (controller.desiredSize !== null && controller.desiredSize <= 0) {
              parser.pause();
            }
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
            this.totalRowsEstimated.value = totalRowsProcessed;
            this.progressSignal.value = null;
          },
          error: (err) => {
            this.logger.log(
              `Error reading file: ${err.message}`,
              "error",
              "createDataStream",
              this.id
            );
            this.logger.updateStatus({
              order: 1,
              progress: 0,
              status: "error",
              step: "createDataStream",
            });
            controller.error(err);
          },
        });
      },
      pull: (controller) => {
        handleAbortSignal(signal, "createDataStream", this.id);
        if (parserInstance) {
          parserInstance.resume();
        }
      },
      cancel: () => parserInstance?.abort(),
    });

    signal?.throwIfAborted();

    return stream;
  }
}

const handleAbortSignal = (
  signal?: AbortSignal,
  step: string = "importFile-papaparse",
  id: string = "importFile-papaparse"
) => {
  if (signal?.aborted) {
    throw new Error("Abort signal received");
  }
};
