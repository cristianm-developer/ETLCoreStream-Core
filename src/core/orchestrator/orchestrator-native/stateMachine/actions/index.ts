import { logAction } from "./log";
import { registerErrorAction } from "./error";
import { resetOrchestratorAction } from "./reset";
import { setFileAction, setLayoutAction } from "./waiting-inputs";
import type { StreamsActions } from "./streams-actions";
import { streamsActions } from "./streams-actions";
import { updateProgressAction } from "./progress";
import { clearReadingDataActorsAction } from "./clear-reading-data-actors";

export type OrchestratorActions =
  | "log"
  | "registerError"
  | "logError"
  | "resetOrchestrator"
  | "setLayout"
  | "setFile"
  | StreamsActions
  | "updateProgress"
  | "clearReadingDataActors";

export const ACTIONS = {
  log: logAction,
  registerError: registerErrorAction,
  resetOrchestrator: resetOrchestratorAction,
  setLayout: setLayoutAction,
  setFile: setFileAction,
  ...streamsActions,
  updateProgress: updateProgressAction,
  clearReadingDataActors: clearReadingDataActorsAction,
} as Record<OrchestratorActions, any>;
