import { assign, raise } from "xstate";
import { STEPS } from "../consts/steps";
import { logEventGen } from "../events/log";
import { mainStateMachineSetup } from "../state-machine-root";
import { errorEventGen } from "../events/error";
import type { ExportEvent, RemoveRowEvent } from "../events/user-events";
import type { OrchestratorContext } from "../schemes/context";
import type {
  EditingRowHandlerInput,
  GlobalStepPipeHandlerInput,
  LocalStepPipeHandlerInput,
} from "../actors/editing-row-handler";

export const stateMachineEditing = mainStateMachineSetup.createStateConfig({
  id: "editing",
  entry: [
    raise(({ self }) =>
      logEventGen.info(
        self,
        "Startig Editing orchestrator stage",
        STEPS.EDITING.WAITING_INITIAL_PROCESSING
      )
    ),
  ],
  initial: "waitingInitialProcessing",
  states: {
    waitingInitialProcessing: {
      always: [
        {
          guard: "isInitialProcessingDone",
          target: "idle",
        },
      ],
    },
    idle: {
      entry: [
        raise(({ self }) =>
          logEventGen.info(
            self,
            "Editing orchestrator stage is ready to receive user interactions",
            STEPS.EDITING.IDLE
          )
        ),
        assign({ processingRows: false }),
        assign({ step: ({ context }) => [...context.step, STEPS.EDITING.IDLE] }),
      ],
      on: {
        EXPORT: {
          target: "exporting",
        },
        REMOVE_ROW: {
          target: "removingRow",
        },
        EDIT_ROW: {
          target: "editingRow",
        },
      },
      exit: [
        assign({
          step: ({ context }) => context.step?.filter((step) => step !== STEPS.EDITING.IDLE) ?? [],
        }),
      ],
    },
    exporting: {
      entry: [
        raise(({ self }) => logEventGen.info(self, "Exporting data", STEPS.EDITING.EXPORTING)),
        assign({ processingRows: true }),
        assign({ step: ({ context }) => [...context.step, STEPS.EDITING.EXPORTING] }),
      ],
      invoke: {
        src: "exporterHandler",
        input: ({ context, event }: { context: OrchestratorContext; event: ExportEvent }) => {
          if (event.type !== "EXPORT") {
            throw new Error("Invalid event type");
          }

          return {
            exportId: event.id,
            layout: context.layout,
            target: event.exportTarget,
            persistenceModule: context.modules!.persistence!,
            exporterModule: context.modules!.exporter!,
            filter: context.viewPaginationInfo?.currentFilter ?? {},
            file: context.file,
          };
        },
        onDone: {
          target: "idle",
        },
        onError: {
          actions: [
            raise(({ self, event }) =>
              errorEventGen.unexpected(self, event.error, STEPS.EDITING.EXPORTING)
            ),
          ],
        },
      },
      exit: [
        assign({
          step: ({ context }) =>
            context.step?.filter((step) => step !== STEPS.EDITING.EXPORTING) ?? [],
        }),
      ],
    },

    removingRow: {
      entry: [
        raise(({ self }) => logEventGen.info(self, "Removing row", STEPS.EDITING.REMOVING_ROW)),
        assign({ processingRows: true }),
        assign({ step: ({ context }) => [...context.step, STEPS.EDITING.REMOVING_ROW] }),
      ],
      invoke: {
        src: "removingRowsHandler",
        input: ({ context, event }: { context: OrchestratorContext; event: RemoveRowEvent }) => {
          if (event.type !== "REMOVE_ROW") {
            throw new Error("Invalid event type");
          }

          return {
            rowId: event.rowId,
            persistenceModule: context.modules!.persistence!,
          };
        },
        onError: {
          actions: [
            raise(({ self, event }) =>
              errorEventGen.unexpected(self, event.error, STEPS.EDITING.REMOVING_ROW)
            ),
          ],
        },
        onDone: {
          target: "updatingMetrics",
        },
      },
      exit: [
        assign({
          step: ({ context }) =>
            context.step?.filter((step) => step !== STEPS.EDITING.REMOVING_ROW) ?? [],
        }),
      ],
    },

    editingRow: {
      entry: [
        raise(({ self }) => logEventGen.info(self, "Editing row", STEPS.EDITING.EDITING_ROW)),
        assign({ processingRows: true }),
        assign(({ event, context }) => {
          if (event.type !== "EDIT_ROW") {
            return context;
          }
          return {
            editPayload: {
              rowId: event.rowId,
              key: event.key,
              value: event.value,
            },
          };
        }),
        assign({ step: ({ context }) => [...context.step, STEPS.EDITING.EDITING_ROW] }),
      ],
      initial: "editingData",
      states: {
        editingData: {
          invoke: {
            src: "editingRowHandler",
            input: ({ context }: { context: OrchestratorContext }) => {
              return {
                rowId: context.editPayload?.rowId,
                key: context.editPayload?.key,
                value: context.editPayload?.value,
                persistenceModule: context.modules!.persistence!,
                viewerModule: context.modules!.viewer!,
              } as EditingRowHandlerInput;
            },
            onError: {
              actions: [
                raise(({ self, event }) =>
                  errorEventGen.unexpected(self, event.error, STEPS.EDITING.EDITING_ROW)
                ),
              ],
            },
            onDone: {
              target: "localStepPipe",
            },
          },
        },
        localStepPipe: {
          invoke: {
            src: "localStepPipeHandler",
            input: ({ context }: { context: OrchestratorContext }) => {
              return {
                rowId: context.editPayload?.rowId,
                localStepEngineModule: context.modules!.localStepEngine!,
                persistenceModule: context.modules!.persistence!,
                layout: context.layout!,
              } as LocalStepPipeHandlerInput;
            },
            onError: {
              actions: [
                raise(({ self, event }) =>
                  errorEventGen.unexpected(self, event.error, STEPS.EDITING.EDITING_ROW)
                ),
              ],
            },
            onDone: {
              target: "globalStepPipe",
            },
          },
        },
        globalStepPipe: {
          invoke: {
            src: "globalStepPipeHandler",
            input: ({ context }: { context: OrchestratorContext }) => {
              return {
                rowId: context.editPayload?.rowId,
                globalStepEngineModule: context.modules!.globalStepEngine!,
                persistenceModule: context.modules!.persistence!,
                layout: context.layout,
              } as GlobalStepPipeHandlerInput;
            },
            onError: {
              actions: [
                raise(({ self, event }) =>
                  errorEventGen.unexpected(self, event.error, STEPS.EDITING.EDITING_ROW)
                ),
              ],
            },
            onDone: {
              target: "updatingMetrics",
            },
          },
        },
      },
      exit: [
        assign(({ context }) => ({
          editPayload: null,
        })),
        assign({
          step: ({ context }) =>
            context.step?.filter((step) => step !== STEPS.EDITING.EDITING_ROW) ?? [],
        }),
      ],
    },

    updatingMetrics: {
      entry: [
        raise(({ self }) =>
          logEventGen.info(self, "Updating metrics", STEPS.EDITING.UPDATING_METRICS)
        ),
        assign({ step: ({ context }) => [...context.step, STEPS.EDITING.UPDATING_METRICS] }),
      ],
      invoke: {
        src: "metricsUpdatingHandler",
        input: ({ context }: { context: OrchestratorContext }) => ({
          persistingModule: context.modules!.persistence!,
          file: context.file,
        }),
        onError: {
          actions: [
            raise(({ self, event }) =>
              errorEventGen.unexpected(self, event.error, STEPS.EDITING.UPDATING_METRICS)
            ),
          ],
        },
        onDone: {
          target: "idle",
        },
      },
      exit: [
        assign({
          step: ({ context }) =>
            context.step?.filter((step) => step !== STEPS.EDITING.UPDATING_METRICS) ?? [],
        }),
      ],
    },
  },
});
