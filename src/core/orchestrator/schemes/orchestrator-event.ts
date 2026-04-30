import type { LayoutBase } from "@/shared/schemes/layout-base";

export type OrchestratorEvent =
  | { type: "LAYOUT_SELECTED"; layout: LayoutBase }
  | { type: "FILE_SELECTED"; file: File }
  | { type: "CHANGE_PAGE"; pageNumber: number }
  | { type: "EDIT_ROW"; rowEdition: { rowId: number; key: string; value: string } }
  | { type: "REMOVE_ROW"; rowId: number }
  | { type: "EXPORT"; id: string; target: "Stream" | "File" }
  | { type: "RESET" }
  | { type: "FIRST_CHUNK_RAW_READY" }
  | { type: "FIRST_CHUNK_PROCESSED_READY" }
  | { type: "FINAL_PROCESSING_READY" }
  | { type: "ALL_CHUNKS_PROCESSED" };
