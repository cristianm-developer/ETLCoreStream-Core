import { ValidationError } from "@/shared/schemes/local-step-validators";
import { RowFilter } from "@/shared/schemes/persistent-filter";
import { RowObject } from "@/shared/schemes/row-object";

export interface OrchestatorContext {
    file: File | null;
    activeStream: ReadableStream | null;
    layout: any | null;
    progress: {label: string, value: number|null}[];
    unexpectedError: string | null;
    metrics?: {
        totalRows: number;
        errorCount: number;
    };
    editingRow: {rowId: number, key: string, value: string} | null;
    removingRow: {rowId: number} | null;
    exporting: { id: string, target: 'Stream'| 'File' } | null;
    currentRowsFilter: RowFilter | null;
    currentRows: RowObject[] | null;
    currentErrors: ValidationError[] | null;
    pageNumber: number;    
    totalEstimatedRows: number | null;
    processingRows: boolean;
}
