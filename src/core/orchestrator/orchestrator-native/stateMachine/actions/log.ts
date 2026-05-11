import { mainStateMachineSetup } from "../state-machine-root";

export const logAction = mainStateMachineSetup.createAction(({ context, event }) => {
  if (event.type !== "LOG") return;

  const logger = context.logger;
  logger?.log(event.message, event.level, event.step, event.id);
});
