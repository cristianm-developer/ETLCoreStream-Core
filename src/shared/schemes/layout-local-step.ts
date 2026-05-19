import type { LocalStepTransform } from "./local-step-transforms";
import type { LocalStepValidator } from "./local-step-validators";

/**
 * Configuration for a local step in the layout pipeline.
 *
 * This type describes a single, named step that can contain zero or more
 * transforms and validators. The `order` field controls the sequence of
 * execution groups (for example, whether transforms run before validators).
 */
export type LayoutLocalStep = {
  /** Stable, unique identifier for this step (used for referencing and persistence). */
  id: string;

  /** Human-readable name shown in UIs and logs. */
  name: string;

  /** Optional longer description for maintainers or UI tooltips. */
  description?: string;

  /**
   * Execution groups order.
   *
   * An array containing the group names in the order they should be executed.
   * Common values are `"transforms"` and `"validators"`. Example: `["transforms", "validators"]`.
   */
  order: ("transforms" | "validators")[];

  /**
   * Optional list of transform modules to run as part of this step.
   * Transforms receive the step input and return the transformed output.
   */
  transforms?: LocalStepTransform[];

  /**
   * Optional list of validator modules to run as part of this step.
   * Validators should inspect input (or transformed output) and return validation results
   * without performing side-effecting mutations.
   */
  validators?: LocalStepValidator[];
};
