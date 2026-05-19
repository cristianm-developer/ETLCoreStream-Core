import type { LogEvent } from "../events/log";
import type { OrchestratorContext } from "../schemes/context";

export const logAction = ({
  context,
  event,
}: {
  context: OrchestratorContext;
  event: LogEvent;
}) => {
  if (event.type !== "LOG") return;

  const logger = context.logger;
  logger?.log(event.message, event.level, event.step, event.id);
};
