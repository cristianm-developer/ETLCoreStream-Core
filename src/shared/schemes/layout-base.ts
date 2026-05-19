import type { Exporter } from "./exporter";
import type { GlobalStep } from "./layout-global-step";
import type { LayoutHeader } from "./layout-header";
import type { LayoutLocalStep } from "./layout-local-step";

/**
 * Base definition for a layout that groups headers, steps and exports.
 *
 * This type contains the minimal set of properties required to describe
 * how input data should be interpreted, transformed, validated and exported.
 */
export type LayoutBase = {
  /**
   * Unique identifier for the layout.
   */
  id: string;

  /**
   * Human-readable name for the layout.
   */
  name: string;

  /**
   * Detailed description explaining the layout's purpose and behavior.
   */
  description?: string;

  /**
   * When true, allows input data to contain columns that are not explicitly
   * declared in `headers`. When false, unexpected columns should be rejected
   * or ignored depending on processing rules.
   */
  allowUndefinedColumns?: boolean;

  /**
   * Ordered list of header definitions describing columns and their rules.
   */
  headers: LayoutHeader[];

  /**
   * Local (per-row) transformation and validation steps applied to each record.
   */
  localSteps: LayoutLocalStep[];

  /**
   * Global steps that operate on the whole dataset or on non-row-scoped logic.
   */
  globalSteps: GlobalStep[];

  /**
   * Exporter configurations defining how and where to output transformed data.
   */
  exports: Exporter[];
};
