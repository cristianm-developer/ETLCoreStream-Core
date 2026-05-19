import type { GlobalStepTransform } from "./global-step-transform";
import type { GlobalStepValidator } from "./global-step-validator";
import type { RowFilter } from "./persistent-filter";

/**
 * Configuration schema for a global step.
 *
 * A global step groups transforms and validators that run across all rows
 * matching the configured filter. The `order` array defines the sequence of
 * execution (e.g., run transforms first, then validators).
 */
export type GlobalStep = {
  /**
   * Human-friendly unique name for the global step.
   */
  name: string;
  /**
   * Optional description providing more context about the step's purpose.
   */
  description?: string;
  /**
   * Array defining execution order. Each item must be either "transforms" or "validators".
   * The engine processes the entries sequentially for each chunk of rows.
   */
  order: ("transforms" | "validators")[];
  /**
   * When true, changing this step's configuration should re-run the step against all rows.
   */
  reprocessAllRowsOnChange?: boolean;
  /**
   * Filter that determines which rows the step applies to.
   */
  filter: {
    /**
     * Row filter predicate or descriptor used to select rows affected by this step.
     */
    rows: RowFilter;
  };
  /**
   * Optional list of transforms to run for this step.
   */
  transforms?: GlobalStepTransform[];
  /**
   * Optional list of validators to run for this step.
   */
  validators?: GlobalStepValidator[];
};
