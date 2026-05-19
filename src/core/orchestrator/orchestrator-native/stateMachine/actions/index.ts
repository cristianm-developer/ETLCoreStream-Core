import { logAction } from "./log";
import { registerErrorAction } from "./error";
import { resetOrchestratorAction } from "./reset";
import { setFileAction, setLayoutAction } from "./waiting-inputs";
import type { StreamsActions } from "./streams-actions";
import { streamsActions } from "./streams-actions";
import { updateProgressAction } from "./progress";
import { clearReadingDataActorsAction } from "./clear-reading-data-actors";
import { stopAction } from "./stop";

export type OrchestratorActions =
  | "log"
  | "registerError"
  | "logError"
  | "resetOrchestrator"
  | "setLayout"
  | "setFile"
  | StreamsActions
  | "updateProgress"
  | "clearReadingDataActors"
  | "stop";

export const ACTIONS = {
  log: logAction,
  registerError: registerErrorAction,
  resetOrchestrator: resetOrchestratorAction,
  setLayout: setLayoutAction,
  setFile: setFileAction,
  ...streamsActions,
  updateProgress: updateProgressAction,
  clearReadingDataActors: clearReadingDataActorsAction,
  stop: stopAction,
} as Record<OrchestratorActions, any>;
