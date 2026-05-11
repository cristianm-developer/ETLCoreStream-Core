import { globalStepsHandler } from "./global-steps-handler";
import { importerHandler } from "./importer-handler";
import { localStepsHandler } from "./local-steps-handler";
import { mappingHandler } from "./mapping-handler";
import { persistenceCleaner } from "./persistence-cleaner";
import { persistenceHandler } from "./persistence-handler";
import { metricsUpdatingHandler } from "./metrics-updating-handler";
import { rowsReader } from "./rows-reader";
import { exporterHandler } from "./exporter-handler";
import { removingRowsHandler } from "./removing-rows-handler";
import {
  editingRowHandler,
  globalStepPipeHandler,
  localStepPipeHandler,
} from "./editing-row-handler";

export type OrchestratorActors =
  | "persistenceCleaner"
  | "importerHandler"
  | "mappingHandler"
  | "localStepsHandler"
  | "persistenceHandler"
  | "globalStepsHandler"
  | "metricsUpdatingHandler"
  | "rowsReader"
  | "exporterHandler"
  | "removingRowsHandler"
  | "editingRowHandler"
  | "localStepPipeHandler"
  | "globalStepPipeHandler";

export const ACTORS = {
  persistenceCleaner,
  importerHandler,
  mappingHandler,
  localStepsHandler,
  persistenceHandler,
  globalStepsHandler,
  metricsUpdatingHandler,
  rowsReader,
  exporterHandler,
  removingRowsHandler,
  editingRowHandler,
  localStepPipeHandler,
  globalStepPipeHandler,
} as Record<OrchestratorActors, any>;
