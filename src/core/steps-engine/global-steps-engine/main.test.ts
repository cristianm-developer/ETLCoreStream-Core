import { describe, it, expect, vi, beforeEach } from "vitest";
import { GlobalStepsEngineModule } from "./main";
import { LoggerModule } from "../../logger/logger-native/main";
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
    fn: vi.fn(async () => ({
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
        rows: vi.fn((_filter: RowFilter) => new ReadableStream()),
        errors: {},
      },
      transforms: [createMockTransform()],
      validators: [createMockValidator()],
      ...overrides,
    };
    return step as GlobalStep;
  };

  const createMockRowObject = (overrides?: Partial<RowObject>): RowObject => ({
    __rowId: 1,
    __sError: null,
    __originalValue: JSON.stringify({ name: "John" }),
    value: { name: "john" },
    ...overrides,
  });

  async function readAllFromHandleStep(
    module: GlobalStepsEngineModule,
    step: GlobalStep,
    chunks: RowObject[][],
    totalRowsEstimated: number | null = null,
    signal?: AbortSignal
  ) {
    const sourceStream = new ReadableStream<{ rows: RowObject[] }>({
      start(controller) {
        for (const rows of chunks) {
          controller.enqueue({ rows });
        }
        controller.close();
      },
    });

    const out = module.handleStep(sourceStream, step, totalRowsEstimated, signal);
    const reader = out.getReader();
    const results: {
      rows: RowObject[];
      errors: ValidationError[];
      removedErrors: number[];
    }[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) results.push(value);
    }
    return results;
  }

  beforeEach(() => {
    mockLogger = {
      log: vi.fn(),
      id: "test-logger",
    };

    vi.mocked(LoggerModule).mockImplementation(() => mockLogger);
    stepsEngineModule = new GlobalStepsEngineModule(mockLogger);
  });

  describe("Constructor", () => {
    it("should initialize with logger", () => {
      new GlobalStepsEngineModule(mockLogger);
      expect(mockLogger.log).toHaveBeenCalledWith(
        "GlobalStepsEngineModule initialized",
        "debug",
        "constructor",
        expect.any(String)
      );
    });

    it("should create module instance", () => {
      const module = new GlobalStepsEngineModule(mockLogger);
      expect(module).toBeDefined();
    });
  });

  describe("handleStep", () => {
    it("should emit rows, errors, and removedErrors per chunk", async () => {
      const step = createMockGlobalStep();
      const rows = [createMockRowObject()];
      const [chunk] = await readAllFromHandleStep(stepsEngineModule, step, [rows]);

      expect(chunk.rows).toHaveLength(1);
      expect(chunk.errors).toEqual([]);
      expect(chunk.removedErrors).toEqual([]);
    });

    it("should run validators then transforms when order is validators, transforms", async () => {
      const transformFn = vi.fn(async (r: RowObject[]) => {
        r.forEach((row) => {
          row.value = { ...row.value, order: "after-transform" };
        });
      });
      const validatorFn = vi.fn(async () => ({
        validationErrors: [],
        removedValidationErrors: [],
      }));

      const step = createMockGlobalStep({
        order: ["validators", "transforms"] as GlobalStep["order"],
        transforms: [
          createMockTransform({
            fn: transformFn,
          }),
        ],
        validators: [
          createMockValidator({
            fn: validatorFn,
          }),
        ],
      });

      await readAllFromHandleStep(stepsEngineModule, step, [[createMockRowObject()]]);

      const validatorOrder = validatorFn.mock.invocationCallOrder[0];
      const transformOrder = transformFn.mock.invocationCallOrder[0];
      expect(validatorOrder).toBeLessThan(transformOrder);
    });

    it("should append validation errors from validators", async () => {
      const validationError: ValidationError = {
        __rowId: 1,
        headerKey: "name",
        validationCode: "INVALID",
        message: "Invalid",
        step: "test",
      };

      const step = createMockGlobalStep({
        validators: [
          createMockValidator({
            fn: vi.fn(async () => ({
              validationErrors: [validationError],
              removedValidationErrors: [],
            })),
          }),
        ],
      });

      const [chunk] = await readAllFromHandleStep(stepsEngineModule, step, [
        [createMockRowObject()],
      ]);

      expect(chunk.errors).toHaveLength(1);
      expect(chunk.errors[0]).toMatchObject({ validationCode: "INVALID" });
    });

    it("should propagate validator failures when reading the stream", async () => {
      const step = createMockGlobalStep({
        validators: [
          createMockValidator({
            fn: vi.fn(async () => {
              throw new Error("Validator error");
            }),
          }),
        ],
      });

      const sourceStream = new ReadableStream<{ rows: RowObject[] }>({
        start(controller) {
          controller.enqueue({ rows: [createMockRowObject()] });
          controller.close();
        },
      });

      const out = stepsEngineModule.handleStep(sourceStream, step, null);
      const reader = out.getReader();

      await expect(reader.read()).rejects.toThrow("Validator error");
    });

    it("should throw if signal is already aborted before piping", () => {
      const controller = new AbortController();
      controller.abort();

      const sourceStream = new ReadableStream<{ rows: RowObject[] }>({
        start(c) {
          c.close();
        },
      });

      expect(() =>
        stepsEngineModule.handleStep(sourceStream, createMockGlobalStep(), null, controller.signal)
      ).toThrow();
    });

    it("should skip rows with __sError for transforms and validators", async () => {
      const transformFn = vi.fn(async (_rows: RowObject[]) => {});
      const validatorFn = vi.fn(async () => ({
        validationErrors: [],
        removedValidationErrors: [],
      }));

      const step = createMockGlobalStep({
        order: ["transforms", "validators"] as GlobalStep["order"],
        transforms: [createMockTransform({ fn: transformFn })],
        validators: [createMockValidator({ fn: validatorFn })],
      });

      const rowOk = createMockRowObject({ __rowId: 1, __sError: null });
      const rowErr = createMockRowObject({ __rowId: 2, __sError: "x" });
      await readAllFromHandleStep(stepsEngineModule, step, [[rowOk, rowErr]]);

      expect(transformFn).toHaveBeenCalledTimes(1);
      const passedRows = transformFn.mock.calls[0][0] as RowObject[];
      expect(passedRows).toHaveLength(1);
      expect(passedRows[0].__rowId).toBe(1);
    });

    it("should update progress from totalRowsEstimated across chunks", async () => {
      const step = createMockGlobalStep({
        transforms: [],
        validators: [],
      });

      const sourceStream = new ReadableStream<{ rows: RowObject[] }>({
        start(controller) {
          controller.enqueue({ rows: [createMockRowObject({ __rowId: 1 })] });
          controller.enqueue({ rows: [createMockRowObject({ __rowId: 2 })] });
          controller.close();
        },
      });

      const out = stepsEngineModule.handleStep(sourceStream, step, 2);
      const reader = out.getReader();
      const progresses: (number | null)[] = [];
      progresses.push(stepsEngineModule.progress);
      while (true) {
        const { done } = await reader.read();
        progresses.push(stepsEngineModule.progress);
        if (done) break;
      }

      expect(progresses.some((p) => p === 50)).toBe(true);
      expect(stepsEngineModule.progress).toBeNull();
    });
  });
});
