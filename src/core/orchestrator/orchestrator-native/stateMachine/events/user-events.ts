import type { RowFilter } from "@/shared";

export type ChangeFilterEvent = {
  type: "CHANGE_FILTER";
  filter: RowFilter;
};

export type ChangePageEvent = {
  type: "CHANGE_PAGE";
  pageNumber: number;
};

export type EditRowEvent = {
  type: "EDIT_ROW";
  rowId: number;
  key: string;
  value: string;
};

export type RemoveRowEvent = {
  type: "REMOVE_ROW";
  rowId: number;
};

export type ExportEvent = {
  type: "EXPORT";
  id: string;
  exportTarget: "Stream" | "File";
};

export type ResetEvent = {
  type: "RESET";
};

export type UserEvents =
  | ChangePageEvent
  | ChangeFilterEvent
  | EditRowEvent
  | RemoveRowEvent
  | ExportEvent
  | ResetEvent;
