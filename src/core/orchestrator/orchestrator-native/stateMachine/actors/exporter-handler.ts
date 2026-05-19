import type { IExporterModule } from "@/core/exporter/i-exporter-module";
import type { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import type { LayoutBase, RowFilter } from "@/shared";
import { fromPromise } from "xstate";

export type ExporterHandlerInput = {
  exportId: string;
  layout: LayoutBase;
  target: "Stream" | "File";
  persistenceModule: IPersistenceModule;
  exporterModule: IExporterModule;
  filter: RowFilter;
  file: File;
  abortSignal: AbortSignal;
};

export const exporterHandler = fromPromise<void, ExporterHandlerInput>(async ({ input }) => {
  const { exportId, layout, target, persistenceModule, exporterModule, filter, file, abortSignal } =
    input;

  const exportKey = exportId;
  const exportObj = layout.exports.find((e) => e.name === exportKey);

  if (!exportObj?.fn) {
    throw new Error(`Export function not found for key: ${exportKey}`);
  }

  const currentFilter: RowFilter = {
    ...filter,
    fromRowId: undefined,
    toRowId: undefined,
    rowIdIn: undefined,
  };

  const stream = persistenceModule.getRowsStream(currentFilter, abortSignal);
  const resultStream = await exporterModule.exportStream(stream, exportObj.fn, abortSignal);

  if (target == "Stream") {
    await exportObj.callback?.(resultStream);
  } else {
    await exporterModule.exportToCsv(
      resultStream,
      file.name + "_" + new Date().toISOString() + ".csv",
      exportObj.labelDicc,
      abortSignal
    );
  }
});
