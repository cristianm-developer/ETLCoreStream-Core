import type { LoggerModule } from "@core/logger/logger-native/main";
import type {
  IExporterModule,
  ExportTransform,
  ExportTemplate,
  ExporterModuleOptions,
} from "../i-exporter-module";
import { DEFAULT_EXPORTER_OPTIONS } from "../i-exporter-module";
import type { RowObject } from "@/shared/schemes/row-object";
import streamsaver from "streamsaver";

export type { ExporterModuleOptions, ExportTransform, ExportTemplate };
export { DEFAULT_EXPORTER_OPTIONS };

export class ExporterNativeModule implements IExporterModule {
  id: string = "exporter-native";
  private logger: LoggerModule;
  private options: ExporterModuleOptions;

  constructor(logger: LoggerModule, options: ExporterModuleOptions = {}) {
    this.logger = logger;
    this.options = { ...DEFAULT_EXPORTER_OPTIONS, ...options };

    if (this.options.externalCdnConfig) {
      this.options.externalCdnConfig();
    }

    this.logger.log("ExporterNativeModule initialized", "debug", "constructor", this.id);
  }

  exportStream = async (
    inputStream: ReadableStream<{ rows: RowObject[] }>,
    exportFn: (row: RowObject) => any,
    signal?: AbortSignal
  ): Promise<ReadableStream> => {
    return inputStream.pipeThrough(
      new TransformStream({
        transform: async (chunk, controller) => {
          signal?.throwIfAborted();

          const { rows } = chunk;

          const parseResult = rows.map((row) => exportFn(row));

          controller.enqueue(parseResult);
        },
      })
    );
  };

  exportToCsv = async (
    inputStream: ReadableStream<any[]>,
    filename: string,
    diccLabels?: Record<string, string>,
    signal?: AbortSignal
  ) => {
    const fileStream = await streamsaver.createWriteStream(
      filename.endsWith(".csv") ? filename : filename + ".csv"
    );

    const writer = fileStream.getWriter();
    const encoder = new TextEncoder();
    const reader = inputStream.getReader();

    let rowCount = 0;
    let bytesWritten = 0;
    let headerInitialized = false;
    let dataKeys: string[] = diccLabels ? Object.values(diccLabels) : [];

    try {
      if (diccLabels) {
        const headerText = Object.values(diccLabels).join(",") + "\n";
        const headerBuffer = encoder.encode(headerText);
        await writer.write(headerBuffer);
        bytesWritten += headerBuffer.length;
        headerInitialized = true;
        dataKeys = Object.keys(diccLabels);
      }

      while (true) {
        signal?.throwIfAborted();
        const { done, value } = await reader.read();
        if (done) break;

        const rows = value;
        if (!rows || rows.length === 0) continue;

        if (!headerInitialized) {
          dataKeys = Object.keys(rows[0]);
          const headerText = dataKeys.join(",") + "\n";
          const headerBuffer = encoder.encode(headerText);
          await writer.write(headerBuffer);
          bytesWritten += headerBuffer.length;
          headerInitialized = true;
        }

        const csvChunk =
          rows
            .map((r: any) =>
              dataKeys
                .map((k) => {
                  const cell = r[k] ?? "";
                  return `"${String(cell).replace(/"/g, '""')}"`;
                })
                .join(",")
            )
            .join("\n") + "\n";

        const csvBuffer = encoder.encode(csvChunk);
        await writer.write(csvBuffer);

        bytesWritten += csvBuffer.length;
        rowCount += rows.length;
      }

      await writer.close();
    } catch (error) {
      await writer.abort();
      throw error;
    } finally {
      reader.releaseLock();
    }
  };

  updateOptions(options: Partial<ExporterModuleOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
