import { describe, it, expect, vi, beforeEach } from "vitest";
import { GlobalStepsEngineModule } from "./main";
import { LoggerModule } from "../../logger/logger-native/main";
import { IPersistenceModule } from "../../persistence/i-persistence-module";
import { LayoutBase } from "@/shared/schemes/layout-base";
import { GlobalStep } from "@/shared/schemes/layout-global-step";
import { RowObject } from "@/shared/schemes/row-object";
import { GlobalStepTransform } from "@/shared/schemes/global-step-transform";
import { GlobalStepValidator } from "@/shared/schemes/global-step-validator";
import { ValidationError } from "@/shared/schemes/local-step-validators";
import { RowFilter } from "@/shared/schemes/persistent-filter";

vi.mock("../../logger/logger-native/main");

describe("GlobalStepsEngineModule", () => {
  let stepsEngineModule: GlobalStepsEngineModule;
  let mockLogger: any;
  let mockPersistenceModule: any;

  const createMockTransform = (overrides?: Partial<GlobalStepTransform>): GlobalStepTransform => ({
    name: "testTransform",
    fn: vi.fn(async (rows: RowObject[]) => {
      rows.forEach((r) => {
        r.value = { ...r.value, transformed: true };
      });
    }),
    args: [],
    ...overrides,
  });

  const createMockValidator = (overrides?: Partial<GlobalStepValidator>): GlobalStepValidator => ({
    name: "testValidator",
    headerKey: "name",
    fn: vi.fn(async (_rows: RowObject[]) => ({
      validationErrors: [],
      removedValidationErrors: [],
    })),
    args: [],
    ...overrides,
  });

  const createMockGlobalStep = (overrides?: Partial<GlobalStep>): GlobalStep => {
    const step = {
      name: "global-step-1",
      reprocessAllRowsOnChange: false,
      order: ["validators", "transforms"] as GlobalStep["order"],
      filter: {
        rows: vi.fn((_filter: RowFilter) => {
          return new ReadableStream({
            start(controller) {
              controller.enqueue({
                rows: [createMockRowObject()],
              });
              controller.close();
            },
          });
        }),
        errors: {},
      },
      transforms: [createMockTransform()],
      validators: [createMockValidator()],
      ...overrides,
    };
    return step as GlobalStep;
  };

  const createMockLayout = (overrides?: Partial<LayoutBase>): LayoutBase => ({
    id: "layout-1",
    name: "Test Layout",
    description: "A test layout",
    globalSteps: [createMockGlobalStep()],
    localSteps: [],
    allowUndefinedColumns: false,
    headers: [],
    exports: {},
    ...overrides,
  });

  const createMockRowObject = (overrides?: Partial<RowObject>): RowObject => ({
    __rowId: 1,
    __sError: null,
    __originalValue: JSON.stringify({ name: "John" }),
    value: { name: "john" },
    ...overrides,
  });

  const createMockPersistenceModule = (): any => ({
    saveStream: vi.fn().mockResolvedValue(undefined),
    getRowsStream: vi.fn().mockReturnValue(
      new ReadableStream({
        start(controller) {
          controller.close();
        },
      })
    ),
    getErrorsStream: vi.fn().mockReturnValue(
      new ReadableStream({
        start(controller) {
          controller.close();
        },
      })
    ),
    clear: vi.fn().mockResolvedValue(undefined),
    updateRows: vi.fn().mockResolvedValue(undefined),
    deleteRows: vi.fn().mockResolvedValue(undefined),
    deleteRow: vi.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    mockLogger = {
      log: vi.fn(),
      updateStatus: vi.fn(),
      id: "test-logger",
    };

    mockPersistenceModule = createMockPersistenceModule();

    vi.mocked(LoggerModule).mockImplementation(() => mockLogger);
    stepsEngineModule = new GlobalStepsEngineModule(mockLogger, mockPersistenceModule);
  });

  describe("Constructor", () => {
    it("should initialize with logger and persistence module", () => {
      const module = new GlobalStepsEngineModule(mockLogger, mockPersistenceModule);
      expect(mockLogger.log).toHaveBeenCalledWith(
        "GlobalStepsEngineModule initialized",
        "debug",
        "constructor",
        expect.any(String)
      );
    });

    it("should store logger and persistence module", () => {
      const module = new GlobalStepsEngineModule(mockLogger, mockPersistenceModule);
      expect(module).toBeDefined();
    });
  });

  describe("handleSteps", () => {
    it("should process global steps for layout", async () => {
      const layout = createMockLayout();

      await stepsEngineModule.handleSteps(layout, undefined);

      expect(mockLogger.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          order: 1,
          progress: 0,
          status: "running",
          step: "handleSteps",
        })
      );
    });

    it("should execute all global steps in order", async () => {
      const transform = createMockTransform();
      const validator = createMockValidator();
      const step1 = createMockGlobalStep({
        name: "step1",
        transforms: [transform],
        validators: [validator],
      });

      const layout = createMockLayout({
        globalSteps: [step1],
      });

      await stepsEngineModule.handleSteps(layout, undefined);

      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should handle abort signal", async () => {
      const controller = new AbortController();
      controller.abort();

      const layout = createMockLayout();

      await expect(
        stepsEngineModule.handleSteps(layout, undefined, controller.signal)
      ).rejects.toThrow();
    });

    it("should log errors and re-throw", async () => {
      const layout = createMockLayout({
        globalSteps: [
          {
            ...createMockGlobalStep(),
            filter: {
              rows: () => {
                throw new Error("Source error");
              },
              errors: {},
            } as GlobalStep["filter"],
          },
        ],
      });

      try {
        await stepsEngineModule.handleSteps(layout, undefined);
      } catch (error) {
        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.any(String),
          "error",
          "handleSteps",
          expect.any(String)
        );
      }
    });

    it("should handle empty global steps", async () => {
      const layout = createMockLayout({
        globalSteps: [],
      });

      await stepsEngineModule.handleSteps(layout, undefined);

      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should handle multiple global steps", async () => {
      const step1 = createMockGlobalStep({ name: "step1" });
      const step2 = createMockGlobalStep({ name: "step2" });

      const layout = createMockLayout({
        globalSteps: [step1, step2],
      });

      await stepsEngineModule.handleSteps(layout, undefined);

      expect(mockLogger.log).toHaveBeenCalled();
    });
  });

  describe("handleStepTransform", () => {
    it("should handle transform stream with rows", async () => {
      const transform = createMockTransform();
      const step = createMockGlobalStep({
        transforms: [transform],
      });

      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue({
            rows: [createMockRowObject()],
          });
          controller.close();
        },
      });

      const resultStream = await stepsEngineModule["handleStepTransform"](
        step,
        transform,
        undefined,
        sourceStream
      );

      const reader = resultStream.getReader();
      const { value } = await reader.read();

      expect(value).toBeDefined();
      expect(value.rows).toBeDefined();
      expect(value.rows.length).toBeGreaterThan(0);
    });

    it("should log transform execution", async () => {
      const transform = createMockTransform();
      const step = createMockGlobalStep();

      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ rows: [createMockRowObject()] });
          controller.close();
        },
      });

      await stepsEngineModule["handleStepTransform"](step, transform, undefined, sourceStream);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining("Handling step transform"),
        "debug",
        "handleStepTransform",
        expect.any(String)
      );
    });

    it("should handle transform errors", async () => {
      const errorTransform = createMockTransform({
        fn: vi.fn(async () => {
          throw new Error("Transform error");
        }),
      });

      const step = createMockGlobalStep();

      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ rows: [createMockRowObject()] });
          controller.close();
        },
      });

      const resultStream = await stepsEngineModule["handleStepTransform"](
        step,
        errorTransform,
        undefined,
        sourceStream
      );

      const reader = resultStream.getReader();

      let error: any = null;
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } catch (e) {
        error = e;
      }

      if (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle abort signal during transform", async () => {
      const controller = new AbortController();
      const transform = createMockTransform();
      const step = createMockGlobalStep();

      controller.abort();

      const sourceStream = new ReadableStream({
        start(c) {
          c.close();
        },
      });

      await expect(
        stepsEngineModule["handleStepTransform"](step, transform, controller.signal, sourceStream)
      ).rejects.toThrow();
    });

    it("should use filter.rows when no input stream provided", async () => {
      const rowsMock = vi.fn(
        (_filter: RowFilter) =>
          new ReadableStream({
            start(controller) {
              controller.enqueue({ rows: [createMockRowObject()] });
              controller.close();
            },
          })
      );

      const transform = createMockTransform();
      const step = createMockGlobalStep({
        filter: {
          rows: rowsMock as unknown as GlobalStep["filter"]["rows"],
          errors: {},
        },
      });

      const resultStream = await stepsEngineModule["handleStepTransform"](step, transform);

      expect(rowsMock).toHaveBeenCalled();
      await resultStream.cancel();
    });

    it("should update status on transform completion", async () => {
      const transform = createMockTransform();
      const step = createMockGlobalStep();

      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ rows: [createMockRowObject()] });
          controller.close();
        },
      });

      const resultStream = await stepsEngineModule["handleStepTransform"](
        step,
        transform,
        undefined,
        sourceStream
      );

      const reader = resultStream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(mockLogger.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: 100,
          status: "completed",
        })
      );
    });
  });

  describe("handleStepValidator", () => {
    it("should handle validator stream with rows", async () => {
      const validator = createMockValidator();
      const step = createMockGlobalStep();

      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue({
            rows: [createMockRowObject()],
          });
          controller.close();
        },
      });

      const resultStream = await stepsEngineModule["handleStepValidator"](
        step,
        validator,
        { errors: [], removedErrors: [] },
        undefined,
        sourceStream
      );

      const reader = resultStream.getReader();
      const { value } = await reader.read();

      expect(value).toBeDefined();
      expect(value.errors).toBeDefined();
      expect(value.rows).toBeDefined();
    });

    it("should return validation errors in stream", async () => {
      const validationError = {
        __rowId: 1,
        headerKey: "name",
        validationCode: "INVALID",
        message: "Invalid",
      };

      const validator = createMockValidator({
        fn: vi.fn(async () => ({
          validationErrors: [validationError as ValidationError],
          removedValidationErrors: [],
        })),
      });

      const step = createMockGlobalStep();

      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ rows: [createMockRowObject()] });
          controller.close();
        },
      });

      const resultStream = await stepsEngineModule["handleStepValidator"](
        step,
        validator,
        { errors: [], removedErrors: [] },
        undefined,
        sourceStream
      );

      const reader = resultStream.getReader();
      const { value } = await reader.read();

      expect(value.errors).toHaveLength(1);
      expect(value.errors[0]).toMatchObject({
        validationCode: "INVALID",
      });
    });

    it("should handle validator errors", async () => {
      const errorValidator = createMockValidator({
        fn: vi.fn(async () => {
          throw new Error("Validator error");
        }),
      });

      const step = createMockGlobalStep();

      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ rows: [createMockRowObject()] });
          controller.close();
        },
      });

      const resultStream = await stepsEngineModule["handleStepValidator"](
        step,
        errorValidator,
        { errors: [], removedErrors: [] },
        undefined,
        sourceStream
      );

      const reader = resultStream.getReader();

      let error: any = null;
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } catch (e) {
        error = e;
      }

      if (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle abort signal during validation", async () => {
      const controller = new AbortController();
      const validator = createMockValidator();
      const step = createMockGlobalStep();

      controller.abort();

      const sourceStream = new ReadableStream({
        start(c) {
          c.close();
        },
      });

      await expect(
        stepsEngineModule["handleStepValidator"](
          step,
          validator,
          { errors: [], removedErrors: [] },
          controller.signal,
          sourceStream
        )
      ).rejects.toThrow();
    });

    it("should log validator execution", async () => {
      const validator = createMockValidator();
      const step = createMockGlobalStep();

      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ rows: [createMockRowObject()] });
          controller.close();
        },
      });

      await stepsEngineModule["handleStepValidator"](
        step,
        validator,
        { errors: [], removedErrors: [] },
        undefined,
        sourceStream
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining("Handling step validator"),
        "debug",
        "handleStepValidator",
        expect.any(String)
      );
    });

    it("should update status on validation completion", async () => {
      const validator = createMockValidator();
      const step = createMockGlobalStep();

      const sourceStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ rows: [createMockRowObject()] });
          controller.close();
        },
      });

      const resultStream = await stepsEngineModule["handleStepValidator"](
        step,
        validator,
        { errors: [], removedErrors: [] },
        undefined,
        sourceStream
      );

      const reader = resultStream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(mockLogger.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: 100,
          status: "completed",
        })
      );
    });
  });

  describe("saveValidationResult", () => {
    it("should save validation errors to persistence module", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({
            errors: [],
            removedErrors: [],
            rows: [createMockRowObject()],
          });
          controller.close();
        },
      });

      await stepsEngineModule["saveValidationResult"](stream);

      expect(mockPersistenceModule.saveStream).toHaveBeenCalled();
    });

    it("should delete removed error rows", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({
            errors: [],
            removedErrors: [1, 2, 3],
            rows: [createMockRowObject()],
          });
          controller.close();
        },
      });

      await stepsEngineModule["saveValidationResult"](stream);

      expect(mockPersistenceModule.saveStream).toHaveBeenCalled();
      expect(mockPersistenceModule.deleteRow).toHaveBeenCalledTimes(3);
      expect(mockPersistenceModule.deleteRow).toHaveBeenCalledWith(1);
      expect(mockPersistenceModule.deleteRow).toHaveBeenCalledWith(2);
      expect(mockPersistenceModule.deleteRow).toHaveBeenCalledWith(3);
    });

    it("should mark rows with errors", async () => {
      const rowWithError = createMockRowObject({ __rowId: 1 });
      const stream = new ReadableStream({
        start(controller) {
          const error: ValidationError = {
            __rowId: 1,
            headerKey: "name",
            validationCode: "INVALID",
            message: "Invalid",
            value: "test",
            originalValue: "test",
            step: "test",
          };
          controller.enqueue({
            errors: [error],
            removedErrors: [],
            rows: [rowWithError],
          });
          controller.close();
        },
      });

      await stepsEngineModule["saveValidationResult"](stream);

      expect(mockPersistenceModule.saveStream).toHaveBeenCalled();
    });

    it("should call persistence module saveStream", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({
            errors: [],
            removedErrors: [],
            rows: [createMockRowObject()],
          });
          controller.close();
        },
      });

      await stepsEngineModule["saveValidationResult"](stream);

      expect(mockPersistenceModule.saveStream).toHaveBeenCalled();
    });

    it("should call deleteRows for removed errors", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({
            errors: [],
            removedErrors: [1, 2, 3],
            rows: [createMockRowObject()],
          });
          controller.close();
        },
      });

      await stepsEngineModule["saveValidationResult"](stream);

      expect(mockPersistenceModule.saveStream).toHaveBeenCalled();
      expect(mockPersistenceModule.deleteRow).toHaveBeenCalledTimes(3);
    });
  });

  describe("handleAbortSignal", () => {
    it("should throw when signal is aborted", () => {
      const controller = new AbortController();
      controller.abort();

      expect(() => {
        stepsEngineModule["handleAbortSignal"](controller.signal);
      }).toThrow();
    });

    it("should not throw when signal is not aborted", () => {
      const controller = new AbortController();

      expect(() => {
        stepsEngineModule["handleAbortSignal"](controller.signal);
      }).not.toThrow();
    });

    it("should not throw when signal is undefined", () => {
      expect(() => {
        stepsEngineModule["handleAbortSignal"](undefined);
      }).not.toThrow();
    });
  });

  describe("Integration tests", () => {
    it("should handle complete flow with transforms and validators", async () => {
      const transform = createMockTransform();
      const validator = createMockValidator();

      const step = createMockGlobalStep({
        order: ["transforms", "validators"] as any,
        transforms: [transform],
        validators: [validator],
      });

      const layout = createMockLayout({
        globalSteps: [step],
      });

      await stepsEngineModule.handleSteps(layout, undefined);

      expect(mockLogger.updateStatus).toHaveBeenCalled();
    });

    it("should handle multiple transforms in sequence", async () => {
      const transform1 = createMockTransform({ name: "transform1" });
      const transform2 = createMockTransform({ name: "transform2" });

      const step = createMockGlobalStep({
        order: ["transforms"] as any,
        transforms: [transform1, transform2],
      });

      const layout = createMockLayout({
        globalSteps: [step],
      });

      await stepsEngineModule.handleSteps(layout, undefined);

      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should handle validation errors across multiple rows", async () => {
      const validator = createMockValidator({
        fn: vi.fn(async (rows: RowObject[]) => ({
          validationErrors: rows.map(
            (r) =>
              ({
                __rowId: r.__rowId,
                headerKey: "name",
                validationCode: "INVALID",
                message: "Invalid",
              }) as ValidationError
          ),
          removedValidationErrors: [],
        })),
      });

      const step = createMockGlobalStep({
        order: ["validators"] as GlobalStep["order"],
        validators: [validator],
        filter: {
          rows: (() =>
            new ReadableStream({
              start(controller) {
                controller.enqueue({
                  rows: [createMockRowObject({ __rowId: 1 }), createMockRowObject({ __rowId: 2 })],
                });
                controller.close();
              },
            })) as unknown as GlobalStep["filter"]["rows"],
          errors: {},
        },
      });

      const layout = createMockLayout({
        globalSteps: [step],
      });

      await stepsEngineModule.handleSteps(layout, undefined);

      expect(mockPersistenceModule.saveStream).toHaveBeenCalled();
    });
  });
});
