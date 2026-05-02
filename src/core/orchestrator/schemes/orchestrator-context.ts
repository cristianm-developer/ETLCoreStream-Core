import type { ValidationError } from "@/shared/schemes/local-step-validators";
import type { RowFilter } from "@/shared/schemes/persistent-filter";
import type { RowObject } from "@/shared/schemes/row-object";

export interface OrchestratorContext {
  file: File | null;
  activeStream: ReadableStream | null;
  layout: any | null;
  progress: { label: string; value: number | null }[];
  unexpectedError: string | null;
  metrics?: {
    totalRows: number;
    errorCount: number;
  };
  editingRow: { rowId: number; key: string; value: string } | null;
  removingRow: { rowId: number } | null;
  exporting: { id: string; target: "Stream" | "File" } | null;
  currentRowsFilter: RowFilter | null;
  currentRows: RowObject[] | null;
  currentErrors: ValidationError[] | null;
  currentPage: number;
  currentFilter: RowFilter | null;
  totalPages: number;
  totalEstimatedRows: number | null;
  processingRows: boolean;
}
