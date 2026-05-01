import type { Observable } from "rxjs";
import type { Log } from "@/shared/schemes/log";

export type LogLevel = "info" | "warn" | "error" | "debug" | "success";
export type StatusType = "idle" | "running" | "completed" | "error" | "paused" | "waiting";

export type StatusLog = {
  order: number;
  progress: number;
  status: StatusType;
  step: string;
};

export type LoggerModuleOptions = {};

export interface ILoggerModule {
  readonly logs$: Observable<Log>;
  readonly status$: Observable<StatusLog>;

  getStatusLog: (order: number) => StatusLog | undefined;

  updateStatus: (status: StatusLog) => void;

  log: (message: string, level: LogLevel, step: string, id: string) => void;

  getLogs: (
    fromTime?: Date,
    toTime?: Date,
    fromIndex?: number,
    toIndex?: number,
    level?: LogLevel,
    step?: string,
    id?: string
  ) => Log[];

  restartLogs: () => void;
  updateOptions(options: Partial<LoggerModuleOptions>): void;
}
