import type { LayoutBase } from "@/shared/schemes/layout-base";

export type WaitingInputsEvent = LayoutSelectedEvent | FileSelectedEvent;

export type LayoutSelectedEvent = {
  type: "LAYOUT_SELECTED";
  layout: LayoutBase;
};

export type FileSelectedEvent = {
  type: "FILE_SELECTED";
  file: File;
};
