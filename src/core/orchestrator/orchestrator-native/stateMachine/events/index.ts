import type { ErrorEvent } from "./error";
import type { LogEvent } from "./log";
import type { ModuleEvents } from "./modules-events";
import type { UserEvents } from "./user-events";
import type { WaitingInputsEvent } from "./waiting-inputs";

export type OrchestratorEvents =
  | LogEvent
  | ErrorEvent
  | ModuleEvents
  | WaitingInputsEvent
  | UserEvents;
