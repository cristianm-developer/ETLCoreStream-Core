import type { RowObject } from "@/shared/schemes/row-object";

export interface ExportTransform<T = any> {
  name: string;
  description: string;
  fn: (row: RowObject) => T;
}

export interface ExportTemplate {
  id: string; // ID único del template
  name: string; // Nombre mostrable al usuario
  description: string; // Descripción de qué incluye
  transforms: ExportTransform[]; // Las transformaciones de este export
}

export interface ExporterModuleOptions {
  chunkSize?: number;
  externalCdnConfig?: () => void;
}

export const DEFAULT_EXPORTER_OPTIONS: ExporterModuleOptions = {
  chunkSize: 500,
};

export interface IExporterModule {
  id: string;

  /**
   * Transforma los datos del stream de entrada aplicando una función de exportación
   */
  exportStream: (
    inputStream: ReadableStream<{ rows: RowObject[] }>,
    exportFn: (row: RowObject) => any,
    signal?: AbortSignal
  ) => Promise<ReadableStream>;

  /**
   * Exporta datos a CSV con escritura incremental (chunk por chunk sin llenar RAM)
   */
  exportToCsv: (
    inputStream: ReadableStream<{ rows: any }>,
    totalRowsCount: number,
    filename: string,
    diccLabels?: Record<string, string>,
    onProgress?: (progress: {
      bytesWritten: number;
      rowsProcessed: number;
      percentage: number;
    }) => void,
    signal?: AbortSignal
  ) => Promise<void>;

  updateOptions(options: Partial<ExporterModuleOptions>): void;
}
