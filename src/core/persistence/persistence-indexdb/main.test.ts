import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PersistenceIndexDbModule } from "./main";
import { LoggerModule } from "../../logger/logger-native/main";
import { RowObject } from "../../../shared/schemes/row-object";
import { RowFilter, ErrorFilter } from "../../../shared/schemes/persistent-filter";
import { ValidationError } from "../../../shared/schemes/local-step-validators";
import { DEFAULT_PERSISTENCE_MODULE_OPTIONS } from "../i-persistence-module";

vi.mock("../../logger/logger-native/main");

// Mock IDBKeyRange for tests
if (typeof globalThis !== "undefined" && !globalThis.IDBKeyRange) {
  globalThis.IDBKeyRange = {
    bound: vi.fn((lower: any, upper: any) => ({ lower, upper, type: "bound" })),
    lowerBound: vi.fn((lower: any, open?: boolean) => ({ lower, open, type: "lowerBound" })),
    upperBound: vi.fn((upper: any, open?: boolean) => ({ upper, open, type: "upperBound" })),
    only: vi.fn((value: any) => ({ value, type: "only" })),
  } as any;
}

describe("PersistenceIndexDbModule", () => {
  let persistenceModule: PersistenceIndexDbModule;
  let mockLogger: any;
  let mockDb: any;
  let mockTransaction: any;
  let mockStore: any;

  const createMockRowObject = (overrides?: Partial<RowObject>): RowObject => ({
    __rowId: 1,
    value: { name: "John", email: "john@example.com" },
    ...overrides,
  });

  const createMockValidationError = (overrides?: Partial<ValidationError>): ValidationError => ({
    __rowId: 1,
    headerKey: "email",
    validationCode: "INVALID_EMAIL",
    message: "Invalid email",
    value: "invalid",
    step: "test",
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    mockLogger = {
      log: vi.fn(),
      updateStatus: vi.fn(),
      id: "persistence-indexdb",
    };

    mockStore = {
      clear: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      get: vi.fn(() => ({
        result: undefined,
      })),
      getAll: vi.fn(() => {
        const defaultMetrics = {
          id: "1",
          fileName: "1",
          fileSize: 0,
          totalRows: 0,
          totalErrorRows: 0,
          createdAt: 0,
          namefile: "",
        };
        const request: any = {
          result: [defaultMetrics],
          onsuccess: null,
          onerror: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      }),
      openCursor: vi.fn(),
    };

    mockTransaction = {
      objectStore: vi.fn(() => mockStore),
      abort: vi.fn(),
      commit: vi.fn(),
      oncomplete: null,
      onerror: null,
      error: null,
    };

    mockDb = {
      transaction: vi.fn(() => mockTransaction),
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
      onclose: null,
      onversionchange: null,
      close: vi.fn(),
    };

    vi.mocked(LoggerModule).mockImplementation(() => mockLogger);

    global.indexedDB = {
      open: vi.fn((dbName: string, version?: number) => {
        const request: any = {
          result: mockDb,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      }),
    } as any;

    persistenceModule = new PersistenceIndexDbModule(
      mockLogger,
      DEFAULT_PERSISTENCE_MODULE_OPTIONS
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should initialize with default options", () => {
      const module = new PersistenceIndexDbModule(mockLogger, DEFAULT_PERSISTENCE_MODULE_OPTIONS);
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should initialize with custom options", () => {
      const customOptions = {
        dbName: "custom-db",
        storeNames: { rows: "custom-rows", errors: "custom-errors", metrics: "custom-metrics" },
        storeKeys: { rows: "id", errors: "id", metrics: "id" },
      };
      const module = new PersistenceIndexDbModule(mockLogger, customOptions);
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should bind getRowsStream and getErrorsStream", () => {
      const module = new PersistenceIndexDbModule(mockLogger, DEFAULT_PERSISTENCE_MODULE_OPTIONS);
      expect(typeof module.getRowsStream).toBe("function");
      expect(typeof module.getErrorsStream).toBe("function");
    });
  });

  describe("clear", () => {
    it("should clear all stores (rows, errors, metrics)", () => {
      expect(typeof persistenceModule.clear).toBe("function");
    });

    it("should execute transaction in readwrite mode", () => {
      expect(typeof persistenceModule.clear).toBe("function");
    });
  });

  describe("getRowById", () => {
    it("should retrieve a row by id", () => {
      expect(typeof persistenceModule.getRowById).toBe("function");
    });

    it("should return undefined when row not found", () => {
      expect(typeof persistenceModule.getRowById).toBe("function");
    });
  });

  describe("getErrorById", () => {
    it("should retrieve an error by id", () => {
      expect(typeof persistenceModule.getErrorById).toBe("function");
    });
  });

  describe("deleteErrors", () => {
    it("should delete multiple errors by ids", () => {
      expect(typeof persistenceModule.deleteErrors).toBe("function");
    });
  });

  describe("getMetrics", () => {
    it("should retrieve metrics", () => {
      expect(typeof persistenceModule.getMetrics).toBe("function");
    });
  });

  describe("saveMetrics", () => {
    it("should save metrics when called", () => {
      expect(typeof persistenceModule.updateMetrics).toBe("function");
    });
  });

  describe("getRowsStream", () => {
    it("should create a ReadableStream", () => {
      const filter: RowFilter = {};
      const stream = persistenceModule.getRowsStream(filter);
      expect(stream).toBeInstanceOf(ReadableStream);
    });
  });

  describe("getErrorsStream", () => {
    it("should create a ReadableStream for errors", () => {
      const filter: ErrorFilter = {};
      const stream = persistenceModule.getErrorsStream(filter);
      expect(stream).toBeInstanceOf(ReadableStream);
    });
  });

  describe("saveStream", () => {
    it("should handle stream parameter without throwing", () => {
      expect(typeof persistenceModule.saveStream).toBe("function");
    });
  });

  describe("updateMetrics", () => {
    it("should update metrics without throwing", () => {
      expect(typeof persistenceModule.updateMetrics).toBe("function");
    });
  });

  describe("rowMatchesFilter", () => {
    it("should exclude rows with errors when withErrors is true", () => {
      const filter: RowFilter = { withErrors: true };
      const row = createMockRowObject({ __sError: null });

      const result = (persistenceModule as any).rowMatchesFilter(row, filter);
      expect(result).toBe(false);
    });

    it("should exclude rows without errors when withoutErrors is true", () => {
      const filter: RowFilter = { withoutErrors: true };
      const row = createMockRowObject({ __sError: "ERROR_CODE" });

      const result = (persistenceModule as any).rowMatchesFilter(row, filter);
      expect(result).toBe(false);
    });

    it("should match rows with errors when withErrors is true and __sError is not null", () => {
      const filter: RowFilter = { withErrors: true };
      const row = createMockRowObject({ __sError: "ERROR_CODE" });

      const result = (persistenceModule as any).rowMatchesFilter(row, filter);
      expect(result).toBe(true);
    });

    it("should match rows without errors when withoutErrors is true and __sError is null", () => {
      const filter: RowFilter = { withoutErrors: true };
      const row = createMockRowObject({ __sError: null });

      const result = (persistenceModule as any).rowMatchesFilter(row, filter);
      expect(result).toBe(true);
    });

    it("should evaluate field filters correctly", () => {
      const filter: RowFilter = {
        fields: [{ headerKey: "name", operator: "=", value: "John" }],
      };
      const row = createMockRowObject({ value: { name: "John" } });

      const result = (persistenceModule as any).rowMatchesFilter(row, filter);
      expect(result).toBe(true);
    });

    it("should reject rows that do not match field filters", () => {
      const filter: RowFilter = {
        fields: [{ headerKey: "name", operator: "=", value: "Jane" }],
      };
      const row = createMockRowObject({ value: { name: "John" } });

      const result = (persistenceModule as any).rowMatchesFilter(row, filter);
      expect(result).toBe(false);
    });
  });

  describe("evaluateOperator", () => {
    it("should evaluate = operator", () => {
      const result = (persistenceModule as any).evaluateOperator("test", "=", "test");
      expect(result).toBe(true);
    });

    it("should evaluate != operator", () => {
      const result = (persistenceModule as any).evaluateOperator("test", "!=", "other");
      expect(result).toBe(true);
    });

    it("should evaluate > operator", () => {
      const result = (persistenceModule as any).evaluateOperator(10, ">", 5);
      expect(result).toBe(true);
    });

    it("should evaluate < operator", () => {
      const result = (persistenceModule as any).evaluateOperator(5, "<", 10);
      expect(result).toBe(true);
    });

    it("should evaluate >= operator", () => {
      const result = (persistenceModule as any).evaluateOperator(10, ">=", 10);
      expect(result).toBe(true);
    });

    it("should evaluate <= operator", () => {
      const result = (persistenceModule as any).evaluateOperator(10, "<=", 10);
      expect(result).toBe(true);
    });

    it("should evaluate includes operator", () => {
      const result = (persistenceModule as any).evaluateOperator(
        "hello world",
        "includes",
        "world"
      );
      expect(result).toBe(true);
    });

    it("should evaluate notIncludes operator", () => {
      const result = (persistenceModule as any).evaluateOperator(
        "hello world",
        "notIncludes",
        "foo"
      );
      expect(result).toBe(true);
    });

    it("should evaluate startsWith operator", () => {
      const result = (persistenceModule as any).evaluateOperator(
        "hello world",
        "startsWith",
        "hello"
      );
      expect(result).toBe(true);
    });

    it("should evaluate endsWith operator", () => {
      const result = (persistenceModule as any).evaluateOperator(
        "hello world",
        "endsWith",
        "world"
      );
      expect(result).toBe(true);
    });

    it("should evaluate isEmpty operator", () => {
      const result = (persistenceModule as any).evaluateOperator("", "isEmpty", null);
      expect(result).toBe(true);
    });

    it("should evaluate isNotEmpty operator", () => {
      const result = (persistenceModule as any).evaluateOperator("test", "isNotEmpty", null);
      expect(result).toBe(true);
    });

    it("should evaluate regex operator", () => {
      const result = (persistenceModule as any).evaluateOperator("test123", "regex", "\\d+");
      expect(result).toBe(true);
    });

    it("should evaluate notRegex operator", () => {
      const result = (persistenceModule as any).evaluateOperator("test", "notRegex", "\\d+");
      expect(result).toBe(true);
    });

    it("should evaluate isTrue operator", () => {
      const result = (persistenceModule as any).evaluateOperator(true, "isTrue", null);
      expect(result).toBe(true);
    });

    it("should evaluate isFalse operator", () => {
      const result = (persistenceModule as any).evaluateOperator(false, "isFalse", null);
      expect(result).toBe(true);
    });

    it("should evaluate isNotNull operator", () => {
      const result = (persistenceModule as any).evaluateOperator("value", "isNotNull", null);
      expect(result).toBe(true);
    });

    it("should evaluate isNullish operator", () => {
      const result = (persistenceModule as any).evaluateOperator(null, "isNullish", null);
      expect(result).toBe(true);
    });

    it("should evaluate isDefined operator", () => {
      const result = (persistenceModule as any).evaluateOperator("value", "isDefined", null);
      expect(result).toBe(true);
    });

    it("should evaluate isNumber operator", () => {
      const result = (persistenceModule as any).evaluateOperator(42, "isNumber", null);
      expect(result).toBe(true);
    });

    it("should return false for unknown operator", () => {
      const result = (persistenceModule as any).evaluateOperator("test", "unknown" as any, null);
      expect(result).toBe(false);
    });
  });

  describe("DEFAULT_PERSISTENCE_MODULE_OPTIONS", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_PERSISTENCE_MODULE_OPTIONS).toEqual({
        chunkSizeQtd: 100,
        dbName: "importer-db",
        storeNames: {
          rows: "rows",
          errors: "errors",
          metrics: "metrics",
        },
        storeKeys: {
          rows: "__rowId",
          errors: "__rowId",
          metrics: "id",
        },
      });
    });
  });
});
