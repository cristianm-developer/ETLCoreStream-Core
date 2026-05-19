import { assign, raise } from "xstate";
import { STEPS } from "../consts/steps";
import { logEventGen } from "../events/log";
import { mainStateMachineSetup } from "../state-machine-setup";
import { errorEventGen } from "../events/error";
import type { ExportEvent, RemoveRowEvent } from "../events/user-events";
import type { OrchestratorContext } from "../schemes/context";
import type {
  EditingRowHandlerInput,
  GlobalStepPipeHandlerInput,
  LocalStepPipeHandlerInput,
} from "../actors/editing-row-handler";
import type { MetricsUpdatingHandlerInput } from "../actors/metrics-updating-handler";
import type { ExporterHandlerInput } from "../actors/exporter-handler";
import type { RemovingRowsHandlerInput } from "../actors/removing-rows-handler";
import type { FileMetrics } from "@/shared";
import type { RecoverPointUpdatingHandlerInput } from "../actors/recover-point-handler";
import type { RecoverPoint } from "@/shared/schemes/recover-point";

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
            layout: context.layout!,
            target: event.exportTarget,
            persistenceModule: context.modules!.persistence!,
            exporterModule: context.modules!.exporter!,
            filter: context.viewPaginationInfo?.currentFilter ?? {},
            file: context.file!,
            abortSignal: context.abortController.signal,
          } satisfies ExporterHandlerInput;
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
          } satisfies RemovingRowsHandlerInput;
        },
        onError: {
          actions: [
            raise(({ self, event }) =>
              errorEventGen.unexpected(self, event.error, STEPS.EDITING.REMOVING_ROW)
            ),
          ],
        },
        onDone: {
          target: "#root.working.editing.updatingMetrics",
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
                rowId: context.editPayload!.rowId!,
                key: context.editPayload!.key!,
                value: context.editPayload!.value!,
                persistenceModule: context.modules!.persistence!,
                viewerModule: context.modules!.viewer!,
                abortSignal: context.abortController.signal,
              } satisfies EditingRowHandlerInput;
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
                rowId: context.editPayload?.rowId ?? 0,
                localStepEngineModule: context.modules!.localStepEngine!,
                persistenceModule: context.modules!.persistence!,
                layout: context.layout!,
                abortSignal: context.abortController.signal,
              } satisfies LocalStepPipeHandlerInput;
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
                rowId: context.editPayload!.rowId!,
                globalStepEngineModule: context.modules!.globalStepEngine!,
                persistenceModule: context.modules!.persistence!,
                layout: context.layout!,
                abortSignal: context.abortController.signal,
              } satisfies GlobalStepPipeHandlerInput;
            },
            onError: {
              actions: [
                raise(({ self, event }) =>
                  errorEventGen.unexpected(self, event.error, STEPS.EDITING.EDITING_ROW)
                ),
              ],
            },
            onDone: {
              target: "#root.working.editing.updatingMetrics",
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
      initial: "updatingMetrics",

      entry: [
        raise(({ self }) =>
          logEventGen.info(self, "Updating metrics", STEPS.EDITING.UPDATING_METRICS)
        ),
        assign({ step: ({ context }) => [...context.step, STEPS.EDITING.UPDATING_METRICS] }),
      ],

      states: {
        updatingMetrics: {
          invoke: {
            src: "metricsUpdatingHandler",
            input: ({ context }: { context: OrchestratorContext }) =>
              ({
                persistingModule: context.modules!.persistence!,
                file: context.file,
                viewerModule: context.modules!.viewer!,
                filter: context.viewPaginationInfo?.currentFilter ?? {},
              }) as MetricsUpdatingHandlerInput,
            onError: {
              actions: [
                raise(({ self, event }) =>
                  errorEventGen.unexpected(
                    self,
                    (event as unknown as ErrorEvent).error,
                    STEPS.UPDATING_METRICS
                  )
                ),
              ],
            },
            onDone: {
              target: "updatingRecoverPoint",
              actions: [
                raise(({ self }) =>
                  logEventGen.info(self, "Metrics updated", STEPS.UPDATING_METRICS)
                ),
                assign(({ event, context }) => {
                  const result = event.output as { metrics: FileMetrics; totalPages: number };

                  return {
                    metrics: result.metrics,
                    viewPaginationInfo: {
                      currentPage: context.viewPaginationInfo?.currentPage ?? 1,
                      totalPages: result.totalPages,
                      currentFilter: context.viewPaginationInfo?.currentFilter ?? {},
                    },
                  };
                }),
              ],
            },
          },
        },
        updatingRecoverPoint: {
          invoke: {
            src: "recoverPointUpdatingHandler",
            input: ({ context }: { context: OrchestratorContext }) =>
              ({
                persistenceModule: context.modules!.persistence!,
                recoverModule: context.modules!.recover!,
                metrics: context.metrics!,
                layout: context.layout!,
              }) satisfies RecoverPointUpdatingHandlerInput,
            onDone: {
              target: "#editing.idle",
              actions: [assign(({ event }) => ({ recoveryPoint: event.output as RecoverPoint }))],
            },
            onError: {
              actions: [
                raise(({ self, event }) =>
                  errorEventGen.unexpected(
                    self,
                    (event as unknown as ErrorEvent).error,
                    STEPS.RECOVERING.UPDATING_RECOVERY_POINT
                  )
                ),
              ],
            },
          },
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
