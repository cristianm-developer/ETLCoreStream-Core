import type { LayoutBase } from "@/shared/schemes/layout-base";
import type { LayoutHeader } from "@/shared/schemes/layout-header";
import type { Signal } from "@preact/signals-core";

/**
 * RemapFn
 *
 * Called when the mapping module requires a mapping dictionary for a given row.
 * - `rowKeys` are the keys/column names present in the incoming row (original input).
 * - `headers` is the list of known layout headers (each header contains `id`, `label`, etc).
 *
 * The function must return a Promise that resolves to an array of tuples:
 *   [originalKey, mappedHeaderId]
 *
 * Important: the first element is the original/incoming key and the second element
 * is the internal header id the core should map that key to.
 */
export type RemapFn = (rowKeys: string[], headers: LayoutHeader[]) => Promise<[string, string][]>;

/**
 * Options accepted by the mapping module.
 *
 * - allowRemapColumns: allow the module to attempt remapping (true) or apply headers as-is (false).
 * - ignoreRemapUnrequired: if true, skip asking for remap when input already meets minimal header requirements.
 * - restCount: optional chunk size / yield frequency for streaming performance.
 * - onRemapFn: optional RemapFn called to obtain user/programmatic mappings.
 * - preserveOriginalValue: keep the original cell value alongside normalized/remapped value.
 */
export type MappingModuleOptions = {
  allowRemapColumns: boolean;
  ignoreRemapUnrequired: boolean;
  restCount?: number;
  onRemapFn?: RemapFn;
  preserveOriginalValue: boolean;
};

/**
 * Defaults for mapping options.
 */
export const DEFAULT_MAP_HEADERS_OPTIONS: MappingModuleOptions = {
  allowRemapColumns: false,
  ignoreRemapUnrequired: false,
  restCount: 10000,
  preserveOriginalValue: false,
};

export interface IMappingModule {
  /**
   * Progress signal (0..100) or null when unknown.
   */
  progress: Signal<number | null>;

  /**
   * handleStream
   *
   * Streaming entry point for mapping. The implementation should read from `stream`,
   * apply header mapping/normalization, and return a transformed ReadableStream.
   *
   * Parameters:
   * - stream: incoming ReadableStream of rows/records
   * - layout: target layout information
   * - totalRowEstimated: signal estimating total rows (may be null)
   * - signal: optional AbortSignal to cancel processing
   * - step: optional step identifier used for logging/metrics
   * - order: optional ordering number for pipeline stages
   */
  handleStream: (
    stream: ReadableStream,
    layout: LayoutBase,
    totalRowEstimated: Signal<number | null>,
    signal?: AbortSignal,
    step?: string,
    order?: number
  ) => Promise<ReadableStream>;

  /**
   * handleRemap
   *
   * Trigger a remap for a single row/layout. Returns the same tuple shape as RemapFn:
   * an array of [originalKey, mappedHeaderId] pairs.
   */
  handleRemap: (layout: LayoutBase, row: any, signal?: AbortSignal) => Promise<[string, string][]>;

  /**
   * updateOptions
   *
   * Update module options at runtime (partial merge).
   */
  updateOptions(options: Partial<MappingModuleOptions>): void;
}
