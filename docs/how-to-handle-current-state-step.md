How to handle "current state" (steps)

Overview

- The orchestrator exposes the currently active steps as an array of strings (an observable, commonly named `step$`). Those strings come from the runtime `STEPS` constant.
- `STEPS` groups all possible step names; use it as the canonical source of truth for step names and categories.

Reference (selected keys from the runtime constants)

```4:48:src/core/orchestrator/orchestrator-native/stateMachine/consts/steps.ts
export const STEPS = {
  ERROR_HANDLING: "Error Handling",
  INITIALIZING_MACHINE: "Initializing Machine",
  // ...
  RECOVERING: {
    CHECKING_RECOVERY_POINT: "Checking Recovery Point",
    WAITING_TO_CHOOSE_RECOVER: "Waiting to Choose to Recover",
    UPDATING_RECOVERY_POINT: "Updating Recovery Point",
    RECOVERING_FROM_RECOVERY_POINT: "Recovering From Recovery Point",
  },
  READING_DATA: {
    WAITING_LAYOUT: "Waiting Layout",
    WAITING_FILE: "Waiting File",
    PROCESSING_INPUTS: "Processing Inputs",
    // ...
  },
  WAITING_INTERACTIONS: {
    WAITING_PROCESSING: "Waiting Processing",
    READING_ROWS: "Reading Rows",
    WAITING_METRICS: "Waiting Metrics",
    WAITING_USER: "Waiting User",
  },
  EDITING: {
    IDLE: "Editing Idle",
    EXPORTING: "Exporting",
    EDITING_ROW: "Editing Row",
    // ...
  },
} as const;
```

Pattern

- Convert the active-steps array into a Set for O(1) membership checks.
- Derive a small object of categorical "current" flags (one value per category or null). Example categories:
  - readerStep (a specific READING_DATA sub-step)
  - viewerStep (a WAITING_INTERACTIONS value)
  - editorStep (an EDITING value)
  - errorStep (ERROR_HANDLING)
  - metricsStep (UPDATING_METRICS or related)
  - recoverStep (a RECOVERING sub-step)
- For categories with multiple possible sub-steps, choose a priority order (the first matching sub-step wins).

Why this helps

- UI or telemetry components can use the small derived object instead of scanning the whole array each render.
- It centralizes priority / precedence rules for overlapping steps.

Example (React hook for illustration only)

- This is an example that listens to `step$` and maps the active steps array to a compact `currentStates` object. The same logic applies in any framework or plain JS.

```typescript
import { useEffect, useState } from "react";
import { useEtlContext } from "../components/etl/etl-context";
import { STEPS, type IOrchestratorModule } from "@etl-corestream/core";

export const useStepsFlgs = (orchestrator: IOrchestratorModule) => {
  const etlContext = orchestrator ? orchestrator : useEtlContext();

  const [currentStates, setCurrentStates] = useState({
    readerStep: null,
    viewerStep: null,
    editorStep: null,
    errorStep: null,
    metricsStep: null,
    recoverStep: null,
  });

  useEffect(() => {
    const subs = etlContext.step$.subscribe((activeSteps) => {
      const stepSet = new Set(activeSteps);

      setCurrentStates({
        readerStep: stepSet.has(STEPS.READING_DATA.WAITING_LAYOUT)
          ? STEPS.READING_DATA.WAITING_LAYOUT
          : stepSet.has(STEPS.READING_DATA.WAITING_FILE)
            ? STEPS.READING_DATA.WAITING_FILE
            : stepSet.has(STEPS.READING_DATA.PROCESSING_INPUTS)
              ? STEPS.READING_DATA.PROCESSING_INPUTS
              : null,
        viewerStep: (Object.values(STEPS.WAITING_INTERACTIONS).find((s) => stepSet.has(s)) ||
          null) as any,
        editorStep: (Object.values(STEPS.EDITING).find((s) => stepSet.has(s)) || null) as any,
        errorStep: stepSet.has(STEPS.ERROR_HANDLING) ? STEPS.ERROR_HANDLING : null,
        metricsStep:
          stepSet.has(STEPS.UPDATING_METRICS) ||
          stepSet.has(STEPS.WAITING_INTERACTIONS.WAITING_METRICS)
            ? STEPS.UPDATING_METRICS
            : null,
        recoverStep: stepSet.has(STEPS.RECOVERING.WAITING_TO_CHOOSE_RECOVER)
          ? STEPS.RECOVERING.WAITING_TO_CHOOSE_RECOVER
          : stepSet.has(STEPS.RECOVERING.UPDATING_RECOVERY_POINT)
            ? STEPS.RECOVERING.UPDATING_RECOVERY_POINT
            : stepSet.has(STEPS.RECOVERING.RECOVERING_FROM_RECOVERY_POINT)
              ? STEPS.RECOVERING.RECOVERING_FROM_RECOVERY_POINT
              : stepSet.has(STEPS.RECOVERING.CHECKING_RECOVERY_POINT)
                ? STEPS.RECOVERING.CHECKING_RECOVERY_POINT
                : null,
      });
    });

    return () => subs.unsubscribe();
  }, []);

  return currentStates;
};
```

Notes

- Different orchestrator implementations may expose steps differently; the important contract is: there must be a way to observe the set/list of active step names so you can derive a human-friendly "current" state.
- Keep step names centralized (the `STEPS` constant) to avoid typos and make UI logic robust.
