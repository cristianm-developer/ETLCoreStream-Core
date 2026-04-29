import { LayoutBase } from "@/shared/schemes/layout-base";



export type OrchestatorEvent =
    | { type: 'LAYOUT_SELECTED'; layout: LayoutBase }
    | { type: 'FILE_SELECTED'; file: File }
    | { type: 'CHANGE_PAGE'; pageNumber: number }
    | { type: 'EDIT_ROW'; rowEdition: {rowId: number, key: string, value: string} }
    | { type: 'REMOVE_ROW'; rowId: number }
    | { type: 'EXPORT'; id: string, target: 'Stream'| 'File' }
    | { type: 'RESET' };