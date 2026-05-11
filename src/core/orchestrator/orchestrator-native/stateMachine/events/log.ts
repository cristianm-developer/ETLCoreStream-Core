import type { LogLevel } from "@/core/logger/i-logger-module";

export type LogEvent = {
  type: "LOG";
  message: string;
  level: LogLevel;
  step: string;
  id: string;
};

export const logEventGen = {
  info: (self: { id: string }, message: string, step: string) => ({
    type: "LOG" as const,
    id: self.id,
    level: "info" as const,
    step: step,
    message: message,
  }),
  warn: (self: { id: string }, message: string, step: string) => ({
    type: "LOG" as const,
    id: self.id,
    level: "warn" as const,
    step: step,
    message: message,
  }),
  error: (self: { id: string }, message: string, step: string) => ({
    type: "LOG" as const,
    id: self.id,
    level: "error" as const,
    step: step,
    message: message,
  }),
  debug: (self: { id: string }, message: string, step: string) => ({
    type: "LOG" as const,
    id: self.id,
    level: "debug" as const,
    step: step,
    message: message,
  }),
};
