import type { IPersistenceModule } from "@/core/persistence";
import type { IRecoverModule } from "@/core/recover/i-recover-module";
import type { IViewerModule } from "@/core/viewer";
import type { FileMetrics, LayoutBase } from "@/shared";
import type { RecoverPoint } from "@/shared/schemes/recover-point";
import { fromPromise } from "xstate";

export type RecoverPointUpdatingHandlerInput = {
  recoverModule: IRecoverModule;
  persistenceModule: IPersistenceModule;
  metrics: FileMetrics;
  layout: LayoutBase;
};

export const recoverPointUpdatingHandler = fromPromise<
  RecoverPoint,
  RecoverPointUpdatingHandlerInput
>(async ({ input }) => {
  const { recoverModule, persistenceModule, metrics, layout } = input;
  const restorePointToUpdate = {
    ...metrics,
    lastUpdatedAt: Date.now(),
    layoutId: layout.id,
  };
  await recoverModule.setRecoveryPoint(restorePointToUpdate, persistenceModule);
  return restorePointToUpdate;
});

export type RecoverPointHandlerInput = {
  recoverModule: IRecoverModule;
  persistenceModule: IPersistenceModule;
  viewerModule: IViewerModule;
  recoveryPoint: RecoverPoint;
};

export type RecoverPointHandlerOutput = {
  totalPages: number;
  metrics: FileMetrics;
  layout: LayoutBase;
  file: File;
};

export const recoverPointHandler = fromPromise<RecoverPointHandlerOutput, RecoverPointHandlerInput>(
  async ({ input }) => {
    const { recoverModule, persistenceModule, viewerModule, recoveryPoint } = input;

    const metrics = await persistenceModule.getMetrics(recoveryPoint.fileName);
    const layout = recoverModule.availableLayouts.find(
      (layout) => layout.id === recoveryPoint.layoutId
    );

    if (!metrics) {
      throw new Error("Metrics not found");
    }
    if (!layout) {
      throw new Error("Layout not found");
    }

    const totalPages = viewerModule.getTotalPages(metrics.totalRows);

    return {
      metrics,
      layout,
      totalPages,
      file: {
        name: recoveryPoint.fileName,
        size: recoveryPoint.fileSize,
      } as File,
    };
  }
);

export type LoadRecoveryPointInput = {
  recoverModule: IRecoverModule;
  persistenceModule: IPersistenceModule;
};

export const loadRecoverPointHandler = fromPromise<RecoverPoint | null, LoadRecoveryPointInput>(
  async ({ input }) => {
    const { recoverModule, persistenceModule } = input;

    const recoverPoint = await recoverModule.getRecoveryPoint(persistenceModule);
    return recoverPoint ?? null;
  }
);
