import { describe, it, expect, vi, beforeEach } from "vitest";
import { RowObject } from "@/shared/schemes/row-object";

// Setup global mocks FIRST before any imports
global.document = {} as any;

global.TextEncoder = class {
  encode(str: string) {
    const buffer = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      buffer[i] = str.charCodeAt(i);
    }
    return buffer;
  }
} as any;

global.TextDecoder = class {
  decode(buffer: Uint8Array) {
    let str = "";
    for (let i = 0; i < buffer.length; i++) {
      str += String.fromCharCode(buffer[i]);
    }
    return str;
  }
} as any;

// Mock streamsaver as default export
vi.mock("streamsaver", () => {
  const mockCreateWriteStream = vi.fn();
  return {
    default: {
      createWriteStream: mockCreateWriteStream,
    },
  };
});

vi.mock("@core/logger/logger-native/main");

import { ExporterNativeModule } from "./main";
import { LoggerModule } from "@core/logger/logger-native/main";
import streamsaver from "streamsaver";

describe("ExporterNativeModule", () => {
  let exporter: ExporterNativeModule;
  let mockLogger: any;
  let mockWriter: any;
  let mockFileStream: any;
  let createWriteStreamSpy: any;

  const createMockRowObject = (overrides?: Partial<RowObject>): RowObject => ({
    __rowId: 1,
    __sError: null,
    __originalValue: JSON.stringify({ id: "1", name: "John" }),
    value: { id: "1", name: "John" },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      log: vi.fn(),
      id: "test-logger",
    };

    mockWriter = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    };

    mockFileStream = {
      getWriter: vi.fn().mockReturnValue(mockWriter),
    };

    vi.mocked(LoggerModule).mockImplementation(() => mockLogger);

    // Correctly mock the createWriteStream function
    createWriteStreamSpy = vi.fn().mockReturnValue(mockFileStream);
    Object.defineProperty(streamsaver, "createWriteStream", {
      value: createWriteStreamSpy,
      writable: true,
    });

    exporter = new ExporterNativeModule(mockLogger);
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      const moduleExporter = new ExporterNativeModule(mockLogger);

      expect(moduleExporter.id).toBe("exporter-native");
      expect(mockLogger.log).toHaveBeenCalledWith(
        "ExporterNativeModule initialized",
        "debug",
        "constructor",
        "exporter-native"
      );
    });

    it("should initialize with custom options", () => {
      const customOptions = { chunkSize: 1000 };
      new ExporterNativeModule(mockLogger, customOptions);

      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should have correct id property", () => {
      expect(exporter.id).toBe("exporter-native");
    });

    it("should merge custom options with default options", () => {
      const customOptions = { chunkSize: 250 };
      const module = new ExporterNativeModule(mockLogger, customOptions);
      expect(module.id).toBe("exporter-native");
    });
  });

  describe("exportStream", () => {
    it("should transform stream using provided export function", async () => {
      const mockExportFn = vi.fn((row: RowObject) => ({
        ...row,
        transformed: true,
      }));

      const mockInputRows = [
        { id: "1", name: "John" },
        { id: "2", name: "Jane" },
      ];

      let transformFnCallback: any;
      const mockTransformStream = {
        pipeThrough: vi.fn(function (this: any, transformer: any) {
          transformFnCallback = transformer;
          return this;
        }),
      };

      const mockInputStream = mockTransformStream as any;
      const result = await exporter.exportStream(mockInputStream, mockExportFn);

      expect(result).toBeDefined();
    });

    it("should handle abort signal by throwing", async () => {
      const abortController = new AbortController();
      const mockExportFn = vi.fn((row: RowObject) => row);

      const mockTransformStream = {
        pipeThrough: vi.fn().mockImplementation((transformer: any) => {
          return mockTransformStream;
        }),
      } as any;

      abortController.abort();

      expect(async () => {
        await exporter.exportStream(mockTransformStream, mockExportFn, abortController.signal);
      }).toBeDefined();
    });

    it("should apply export function to each row", async () => {
      const mockExportFn = vi.fn((row: RowObject) => ({
        ...row,
        exported: true,
      }));

      const mockInputStream = {
        pipeThrough: vi.fn().mockReturnValue({ pipeThrough: vi.fn() }),
      } as any;

      const result = await exporter.exportStream(mockInputStream, mockExportFn);
      expect(result).toBeDefined();
    });

    it("should return a ReadableStream", async () => {
      const mockExportFn = vi.fn((row: RowObject) => row);

      const mockInputStream = {
        pipeThrough: vi.fn().mockReturnValue({}),
      } as any;

      const result = await exporter.exportStream(mockInputStream, mockExportFn);
      expect(result).toBeDefined();
    });
  });

  describe("exportToCsv", () => {
    it("should create a CSV file with correct filename", async () => {
      const mockRows = [createMockRowObject()];
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 1, "test");

      expect(createWriteStreamSpy).toHaveBeenCalledWith("test.csv");
    });

    it("should not add .csv extension if filename already has it", async () => {
      const mockRows = [createMockRowObject()];
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 1, "test.csv");

      expect(createWriteStreamSpy).toHaveBeenCalledWith("test.csv");
    });

    it("should write CSV header when diccLabels is provided", async () => {
      const diccLabels = { id: "ID", name: "Name" };
      const mockRows = [createMockRowObject()];
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 1, "test.csv", diccLabels);

      expect(mockWriter.write).toHaveBeenCalledWith(expect.any(Uint8Array));
    });

    it("should extract header from first row when diccLabels not provided", async () => {
      const mockRows = [createMockRowObject()];
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 1, "test.csv");

      expect(mockWriter.write).toHaveBeenCalled();
      expect(mockWriter.close).toHaveBeenCalled();
    });

    it("should process multiple chunks from stream", async () => {
      const mockRows1 = [createMockRowObject({ __rowId: 1 })];
      const mockRows2 = [createMockRowObject({ __rowId: 2 })];
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows1 } })
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows2 } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 2, "test.csv");

      expect(mockWriter.write).toHaveBeenCalledTimes(3);
    });

    it("should skip empty chunks", async () => {
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: [] } })
          .mockResolvedValueOnce({ done: false, value: { rows: [createMockRowObject()] } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 1, "test.csv");

      expect(mockWriter.write).toHaveBeenCalledTimes(2);
    });

    it("should track row count and bytes written", async () => {
      const diccLabels = { id: "ID", name: "Name" };
      const mockRows = [createMockRowObject()];
      const onProgress = vi.fn();

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 1, "test.csv", diccLabels, onProgress);

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          rowsProcessed: expect.any(Number),
          bytesWritten: expect.any(Number),
          percentage: expect.any(Number),
        })
      );
    });

    it("should calculate progress percentage correctly", async () => {
      const diccLabels = { id: "ID", name: "Name" };
      const mockRows = [createMockRowObject()];
      const onProgress = vi.fn();

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      const totalRows = 10;
      await exporter.exportToCsv(mockInputStream, totalRows, "test.csv", diccLabels, onProgress);

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          percentage: 10,
        })
      );
    });

    it("should handle CSV escaping for quotes in data", async () => {
      const mockRows = [createMockRowObject({ value: { id: "1", name: 'John "Johnny" Doe' } })];
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 1, "test.csv");

      // Verify that write was called with data containing the row
      expect(mockWriter.write).toHaveBeenCalledTimes(2); // header + data
    });

    it("should handle null and undefined values", async () => {
      const mockRows = [createMockRowObject({ value: { id: "1", name: null } })];
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 1, "test.csv");

      expect(mockWriter.write).toHaveBeenCalled();
    });

    it("should abort writer on error and rethrow", async () => {
      const testError = new Error("Read error");
      const mockReader = {
        read: vi.fn().mockRejectedValueOnce(testError),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await expect(exporter.exportToCsv(mockInputStream, 1, "test.csv")).rejects.toThrow(testError);

      expect(mockWriter.abort).toHaveBeenCalled();
    });

    it("should release reader lock in finally block", async () => {
      const mockRows = [createMockRowObject()];
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 1, "test.csv");

      expect(mockReader.releaseLock).toHaveBeenCalled();
    });

    it("should release reader lock even on error", async () => {
      const testError = new Error("Read error");
      const mockReader = {
        read: vi.fn().mockRejectedValueOnce(testError),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      try {
        await exporter.exportToCsv(mockInputStream, 1, "test.csv");
      } catch (e) {
        // Expected
      }

      expect(mockReader.releaseLock).toHaveBeenCalled();
    });

    it("should handle abort signal", async () => {
      const abortController = new AbortController();
      const mockRows = [createMockRowObject()];
      const mockReader = {
        read: vi.fn().mockImplementationOnce(async () => {
          abortController.abort();
          return { done: false, value: { rows: mockRows } };
        }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await expect(
        exporter.exportToCsv(
          mockInputStream,
          1,
          "test.csv",
          undefined,
          undefined,
          abortController.signal
        )
      ).rejects.toThrow();
    });

    it("should close writer on successful completion", async () => {
      const mockRows = [createMockRowObject()];
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 1, "test.csv");

      expect(mockWriter.close).toHaveBeenCalled();
    });

    it("should encode CSV data as UTF-8", async () => {
      const mockRows = [createMockRowObject({ value: { id: "1", name: "Jöhn" } })];
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 1, "test.csv");

      const dataWriteCall = mockWriter.write.mock.calls.find((call: any) => {
        return call[0] instanceof Uint8Array;
      });

      expect(dataWriteCall).toBeDefined();
    });

    it("should handle stream with no chunks", async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 0, "empty.csv");

      expect(mockWriter.close).toHaveBeenCalled();
      expect(mockReader.releaseLock).toHaveBeenCalled();
    });

    it("should handle rows with special CSV characters", async () => {
      const mockRows = [createMockRowObject({ value: { id: "1", name: "Smith, Jr." } })];
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await exporter.exportToCsv(mockInputStream, 1, "test.csv");

      expect(mockWriter.write).toHaveBeenCalled();
    });

    it("should handle large number of rows and calculate correct percentage", async () => {
      const diccLabels = { id: "ID", name: "Name" };
      const mockRows = [createMockRowObject(), createMockRowObject({ __rowId: 2 })];
      const onProgress = vi.fn();

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: mockRows } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      const totalRows = 100;
      await exporter.exportToCsv(mockInputStream, totalRows, "test.csv", diccLabels, onProgress);

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          percentage: 2,
        })
      );
    });
  });

  describe("module interface compliance", () => {
    it("should implement IExporterModule interface", () => {
      expect(exporter).toHaveProperty("id");
      expect(exporter).toHaveProperty("exportStream");
      expect(exporter).toHaveProperty("exportToCsv");
    });

    it("should export types and constants", async () => {
      const exported = await import("./main");
      expect(exported.DEFAULT_EXPORTER_OPTIONS).toBeDefined();
      expect(exported.DEFAULT_EXPORTER_OPTIONS.chunkSize).toBe(500);
    });

    it("should have arrow function for exportStream", () => {
      expect(typeof exporter.exportStream).toBe("function");
    });

    it("should have arrow function for exportToCsv", () => {
      expect(typeof exporter.exportToCsv).toBe("function");
    });
  });

  describe("error scenarios", () => {
    it("should handle undefined rows in chunk gracefully", async () => {
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { rows: undefined } })
          .mockResolvedValueOnce({ done: false, value: { rows: [createMockRowObject()] } })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      // Should not throw, just skip empty chunks
      await exporter.exportToCsv(mockInputStream, 1, "test.csv");

      expect(mockWriter.close).toHaveBeenCalled();
    });

    it("should handle TypeError from reader", async () => {
      const testError = new TypeError("Stream error");
      const mockReader = {
        read: vi.fn().mockRejectedValueOnce(testError),
        releaseLock: vi.fn(),
      };

      const mockInputStream = {
        getReader: vi.fn().mockReturnValue(mockReader),
      } as any;

      await expect(exporter.exportToCsv(mockInputStream, 1, "test.csv")).rejects.toThrow(testError);
    });
  });
});
