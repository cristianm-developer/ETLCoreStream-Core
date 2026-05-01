import type { Log } from "../../../shared/schemes/log";
import type { Observable } from "rxjs";
import { Subject } from "rxjs";
import type { ILoggerModule, LoggerModuleOptions, StatusLog } from "../i-logger-module";

export type { StatusLog };

export class LoggerModule implements ILoggerModule {
  public id = "logger" as const;

  private logs: Log[] = [];
  private config: LoggerModuleOptions;
  private logSubject = new Subject<Log>();

  readonly logs$: Observable<Log> = this.logSubject.asObservable();

  private statusLog: {
    order: number;
    progress: number;
    status: "idle" | "running" | "completed" | "error" | "paused" | "waiting";
    step: string;
  }[] = [];

  private statusSubject = new Subject<{
    order: number;
    progress: number;
    status: "idle" | "running" | "completed" | "error" | "paused" | "waiting";
    step: string;
  }>();
  readonly status$: Observable<{
    order: number;
    progress: number;
    status: "idle" | "running" | "completed" | "error" | "paused" | "waiting";
    step: string;
  }> = this.statusSubject.asObservable();

  getStatusLog = (order: number) => this.statusLog.find((status) => status.order === order);

  updateStatus: (status: {
    order: number;
    progress: number;
    status: "idle" | "running" | "completed" | "error" | "paused" | "waiting";
    step: string;
  }) => void = (status) => {
    this.statusLog.push(status);
    this.statusSubject.next(status);
  };

  log: (
    message: string,
    level: "info" | "warn" | "error" | "debug" | "success",
    step: string,
    id: string
  ) => void = (message, level, step) => {
    this.logs.push({ timestamp: new Date(), id: this.id, message, level, step });
    this.logSubject.next({ timestamp: new Date(), id: this.id, message, level, step });
  };

  getLogs: (
    fromTime?: Date,
    toTime?: Date,
    fromIndex?: number,
    toIndex?: number,
    level?: "info" | "warn" | "error" | "debug" | "success",
    step?: string,
    id?: string
  ) => Log[] = (fromTime, toTime, fromIndex, toIndex, level, step, id) => {
    fromIndex ??= 0;
    toIndex ??= this.logs.length - 1;

    const slicedLogs = this.logs.slice(fromIndex, toIndex + 1);

    return slicedLogs.filter((log) => {
      const matchesTime =
        fromTime && toTime ? log.timestamp >= fromTime && log.timestamp <= toTime : true;

      const matchesLevel = level ? log.level === level : true;
      const matchesStep = step ? log.step === step : true;
      const matchesId = id ? log.id === id : true;

      return matchesTime && matchesLevel && matchesStep && matchesId;
    });
  };

  restartLogs: () => void = () => (this.logs = []);

  updateOptions(options: Partial<LoggerModuleOptions>): void {
    this.config = { ...this.config, ...options };
  }

  constructor(config: LoggerModuleOptions = {}) {
    this.config = config;
  }
}
