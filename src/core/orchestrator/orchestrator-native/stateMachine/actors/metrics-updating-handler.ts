import type { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import type { IViewerModule } from "@/core/viewer/i-viewer-module";
import type { FileMetrics, RowFilter } from "@/shared";
import { fromPromise } from "xstate";

export type MetricsUpdatingHandlerInput = {
  persistingModule: IPersistenceModule;
  viewerModule: IViewerModule;
  file: File;
  filter?: RowFilter;
};

export const metricsUpdatingHandler = fromPromise<
  { metrics: FileMetrics; totalPages: number },
  MetricsUpdatingHandlerInput
>(async ({ input }) => {
  const { persistingModule, viewerModule, file, filter } = input;

  await persistingModule.updateMetrics(file.name, filter);
  const metrics = await persistingModule.getMetrics(file.name);
  const totalPages = viewerModule.getTotalPages(metrics?.totalRows ?? 0);

  if (!metrics) {
    throw new Error("Metrics not found");
  }

  return { metrics, totalPages };
});
