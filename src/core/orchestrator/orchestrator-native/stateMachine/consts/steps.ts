import type { DeepTypeValue, Flatten } from "@/shared/utils/deepTypeValue";

export const STEPS = {
  ERROR_HANDLING: "Error Handling",
  INITIALIZING_MACHINE: "Initializing Machine",
  CLEANING_PERSISTENCE: "Cleaning Persistence",
  RESETING_ORCHESTRATOR: "Resetting Orchestrator",

  RECOVERING: {
    CHECKING_RECOVERY_POINT: "Checking Recovery Point",
    WAITING_TO_CHOOSE_RECOVER: "Waiting to Choose to Recover",
    UPDATING_RECOVERY_POINT: "Updating Recovery Point",
    RECOVERING_FROM_RECOVERY_POINT: "Recovering From Recovery Point",
  },

  READING_DATA: {
    INITIALIZING: "Reading File Initializing",

    WAITING_INPUTS: "Waiting Inputs",
    WAITING_LAYOUT: "Waiting Layout",
    WAITING_FILE: "Waiting File",

    PROCESSING_INPUTS: "Processing Inputs",
    IMPORTING_DATA: "Importing Data",
    MAPPING_DATA: "Mapping Data",
    HANDLING_LOCAL_STEPS: "Handling Local Steps",
    PERSISTING_DATA: "Persisting Data",
    HANDLING_GLOBAL_STEPS: "Handling Global Steps",
  },

  UPDATING_METRICS: "Updating Metrics",

  WAITING_INTERACTIONS: {
    WAITING_PROCESSING: "Waiting Processing",
    READING_ROWS: "Reading Rows",
    WAITING_METRICS: "Waiting Metrics",
    WAITING_USER: "Waiting User",
  },

  EDITING: {
    WAITING_INITIAL_PROCESSING: "Waiting Initial Processing",
    IDLE: "Editing Idle",
    EXPORTING: "Exporting",
    REMOVING_ROW: "Removing Row",
    EDITING_ROW: "Editing Row",
    UPDATING_METRICS: "Updating Metrics",
  },
} as const;

export type StepsValue = Flatten<DeepTypeValue<typeof STEPS>>;
