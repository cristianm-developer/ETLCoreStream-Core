import type { Signal } from "@preact/signals-core";

export interface ImportFileModuleOptions {
  chunkSize?: number;
  worker?: boolean;
  allowedMimetypes?: string[];
  maxFileSize?: number;
}

export const DEFAULT_IMPORT_FILE_MODULE_OPTIONS: ImportFileModuleOptions = {
  chunkSize: 1024 * 1024 * 30,
  worker: true,
  allowedMimetypes: [
    "text/csv",
    "text/plain",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
    "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
  ],
  maxFileSize: 1024 * 1024 * 100,
};

export interface StreamControls {
  pause: () => void;
  resume: () => void;
  abort: () => void;
}

export interface StreamResult {
  stream: ReadableStream;
  controls: StreamControls;
}

export interface IImportFileModule {
  readFileStream: (file: File, signal?: AbortSignal) => [ReadableStream, Signal<number | null>];
  progress: number;
  updateOptions(options: Partial<ImportFileModuleOptions>): void;
}
