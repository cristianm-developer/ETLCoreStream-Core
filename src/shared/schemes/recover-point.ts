import type { FileMetrics } from "./file-metrics";

export type RecoverPoint = {
  lastUpdatedAt: number;
  layoutId: string;
} & FileMetrics;
