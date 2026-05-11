import type { DeepTypeValue } from "@/shared/utils/deepTypeValue";

export const STEPS = {
  ERROR_HANDLING: "Error Handling",
  INITIALIZING_MACHINE: "Initializing Machine",
  CLEANING_PERSISTENCE: "Cleaning Persistence",
  RESETING_ORCHESTRATOR: "Resetting Orchestrator",

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

export type StepsValue = DeepTypeValue<typeof STEPS>;
