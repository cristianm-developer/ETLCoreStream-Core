import { describe, it, expect, vi, beforeEach } from "vitest";
import { ViewerModule } from "./main";
import { LoggerModule } from "../../logger/logger-native/main";
import { FileMetrics } from "@/shared/schemes/file-metrics";
import { RowFilter } from "@/shared/schemes/persistent-filter";
import { RowObject } from "@/shared/schemes/row-object";
import { EditRowPayload, ViewerModuleOptions } from "../i-viewer-module";

vi.mock("../../logger/logger-native/main");

describe("ViewerModule", () => {
  let viewerModule: ViewerModule;
  let mockLogger: any;
  let mockPersistenceModule: any;
  let defaultOptions: ViewerModuleOptions;

  const createMockRowObject = (overrides?: Partial<RowObject>): RowObject => ({
    __rowId: 1,
    __isError: null,
    __originalValue: "original_data",
    value: { name: "John", email: "john@test.com" },
    ...overrides,
  });

  const createMockFileMetrics = (overrides?: Partial<FileMetrics>): FileMetrics => ({
    id: "metrics-1",
    totalRows: 100,
    totalErrorRows: 0,
    fileName: "test.xlsx",
    fileSize: 1024,
    createdAt: Date.now(),
    namefile: "test.xlsx",
    ...overrides,
  });

  const createMockReadableStream = (chunks: any[] = []) => {
    let chunkIndex = 0;

    return new ReadableStream({
      start(controller) {
        if (chunks.length === 0) {
          controller.close();
        } else {
          chunks.forEach((chunk) => {
            controller.enqueue(chunk);
          });
          controller.close();
        }
      },
    });
  };

  beforeEach(() => {
    defaultOptions = {
      defaultPageSize: 25,
      defaultFilter: { withErrors: true, withoutErrors: true },
    };

    mockLogger = {
      log: vi.fn(),
      updateStatus: vi.fn(),
      id: "test-logger",
    };

    mockPersistenceModule = {
      getRowsStream: vi.fn(),
      getErrorsStream: vi.fn(),
      getRowById: vi.fn(),
      updateRow: vi.fn(),
      deleteRow: vi.fn(),
      deleteErrors: vi.fn(),
      updateMetrics: vi.fn(),
    };

    vi.mocked(LoggerModule).mockImplementation(() => mockLogger);
    viewerModule = new ViewerModule(mockLogger, defaultOptions);
  });

  describe("Constructor", () => {
    it('should initialize with id "viewer-native"', () => {
      expect(viewerModule.id).toBe("viewer-native");
    });

    it("should initialize with provided options", () => {
      const customOptions: ViewerModuleOptions = {
        defaultPageSize: 50,
        defaultFilter: { withErrors: true, withoutErrors: false },
      };
      const module = new ViewerModule(mockLogger, customOptions);
      expect(module.id).toBe("viewer-native");
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should log initialization message", () => {
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining("ViewerModule initialized"),
        "debug",
        "constructor",
        "viewer-native"
      );
    });
  });

  describe("getTotalPages", () => {
    it("should calculate correct number of pages", () => {
      const totalPages = viewerModule.getTotalPages(100);
      expect(totalPages).toBe(4);
    });

    it("should handle exact page boundaries", () => {
      const totalPages = viewerModule.getTotalPages(75);
      expect(totalPages).toBe(3);
    });

    it("should return 1 for partial first page", () => {
      const totalPages = viewerModule.getTotalPages(10);
      expect(totalPages).toBe(1);
    });

    it("should return 1 for single page size", () => {
      const totalPages = viewerModule.getTotalPages(25);
      expect(totalPages).toBe(1);
    });

    it("should handle zero rows", () => {
      const totalPages = viewerModule.getTotalPages(0);
      expect(totalPages).toBe(0);
    });

    it("should handle large datasets", () => {
      const totalPages = viewerModule.getTotalPages(10000);
      expect(totalPages).toBe(400);
    });
  });

  describe("getRowsWithPagination", () => {
    it("should fetch first page with default parameters", async () => {
      const metrics = createMockFileMetrics({ totalRows: 100 });
      const rows = [createMockRowObject()];
      const errors = [];

      mockPersistenceModule.getRowsStream.mockReturnValue(
        createMockReadableStream([{ rows, progress: 100, bytesProcessed: 1024 }])
      );
      mockPersistenceModule.getErrorsStream.mockReturnValue(
        createMockReadableStream([{ errors, progress: 100, bytesProcessed: 512 }])
      );

      const result = await viewerModule.getRowsWithPagination(mockPersistenceModule, metrics);

      expect(result.rows).toEqual(rows);
      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(25);
      expect(result.totalRows).toBe(100);
      expect(result.totalPages).toBe(4);
      expect(result.errors).toEqual(errors);
    });

    it("should calculate correct page range", async () => {
      const metrics = createMockFileMetrics({ totalRows: 100 });
      const rows: RowObject[] = [];
      const errors = [];

      mockPersistenceModule.getRowsStream.mockReturnValue(
        createMockReadableStream([{ rows, progress: 100, bytesProcessed: 1024 }])
      );
      mockPersistenceModule.getErrorsStream.mockReturnValue(
        createMockReadableStream([{ errors, progress: 100, bytesProcessed: 512 }])
      );

      await viewerModule.getRowsWithPagination(mockPersistenceModule, metrics, undefined, 2);

      expect(mockPersistenceModule.getRowsStream).toHaveBeenCalledWith(
        expect.objectContaining({
          fromRowId: 26,
          toRowId: 50,
        })
      );
    });

    it("should apply custom filter to pagination", async () => {
      const metrics = createMockFileMetrics({ totalRows: 100 });
      const filter: RowFilter = { fromRowId: 10, toRowId: 20 };
      const rows: RowObject[] = [];
      const errors = [];

      mockPersistenceModule.getRowsStream.mockReturnValue(
        createMockReadableStream([{ rows, progress: 100, bytesProcessed: 1024 }])
      );
      mockPersistenceModule.getErrorsStream.mockReturnValue(
        createMockReadableStream([{ errors, progress: 100, bytesProcessed: 512 }])
      );

      await viewerModule.getRowsWithPagination(mockPersistenceModule, metrics, filter);

      expect(mockPersistenceModule.getRowsStream).toHaveBeenCalledWith(
        expect.objectContaining({
          fromRowId: 10,
          toRowId: 20,
        })
      );
    });

    it("should clamp page number to total pages", async () => {
      const metrics = createMockFileMetrics({ totalRows: 50 });
      const rows: RowObject[] = [];
      const errors = [];

      mockPersistenceModule.getRowsStream.mockReturnValue(
        createMockReadableStream([{ rows, progress: 100, bytesProcessed: 1024 }])
      );
      mockPersistenceModule.getErrorsStream.mockReturnValue(
        createMockReadableStream([{ errors, progress: 100, bytesProcessed: 512 }])
      );

      const result = await viewerModule.getRowsWithPagination(
        mockPersistenceModule,
        metrics,
        undefined,
        100
      );

      expect(result.currentPage).toBe(2);
    });

    it("should handle abort signal", async () => {
      const metrics = createMockFileMetrics();
      const controller = new AbortController();
      controller.abort();

      mockPersistenceModule.getRowsStream.mockReturnValue(createMockReadableStream());
      mockPersistenceModule.getErrorsStream.mockReturnValue(createMockReadableStream());

      await expect(
        viewerModule.getRowsWithPagination(
          mockPersistenceModule,
          metrics,
          undefined,
          1,
          controller.signal
        )
      ).rejects.toThrow();
    });

    it("should fetch validation errors for the page", async () => {
      const metrics = createMockFileMetrics({ totalRows: 100 });
      const rows: RowObject[] = [];
      const errors = [{ headerKey: "name", validationCode: "INVALID", message: "Invalid name" }];

      mockPersistenceModule.getRowsStream.mockReturnValue(
        createMockReadableStream([{ rows, progress: 100, bytesProcessed: 1024 }])
      );
      mockPersistenceModule.getErrorsStream.mockReturnValue(
        createMockReadableStream([{ errors, progress: 100, bytesProcessed: 512 }])
      );

      const result = await viewerModule.getRowsWithPagination(mockPersistenceModule, metrics);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          headerKey: "name",
          validationCode: "INVALID",
        })
      );
    });

    it("should handle multiple row chunks", async () => {
      const metrics = createMockFileMetrics({ totalRows: 100 });
      const rows1 = [createMockRowObject({ __rowId: 1 })];
      const rows2 = [createMockRowObject({ __rowId: 2 })];

      mockPersistenceModule.getRowsStream.mockReturnValue(
        createMockReadableStream([
          { rows: rows1, progress: 50, bytesProcessed: 512 },
          { rows: rows2, progress: 100, bytesProcessed: 1024 },
        ])
      );
      mockPersistenceModule.getErrorsStream.mockReturnValue(createMockReadableStream([]));

      const result = await viewerModule.getRowsWithPagination(mockPersistenceModule, metrics);

      expect(result.rows).toHaveLength(2);
    });

    it("should log pagination fetch", async () => {
      const metrics = createMockFileMetrics();

      mockPersistenceModule.getRowsStream.mockReturnValue(createMockReadableStream());
      mockPersistenceModule.getErrorsStream.mockReturnValue(createMockReadableStream());

      await viewerModule.getRowsWithPagination(mockPersistenceModule, metrics, undefined, 2);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining("Fetching rows with pagination"),
        "debug",
        "getRowsWithPagination",
        "viewer-native"
      );
    });

    it("should throw error on pagination failure", async () => {
      const metrics = createMockFileMetrics();
      const error = new Error("Stream read failed");

      mockPersistenceModule.getRowsStream.mockImplementation(() => {
        throw error;
      });

      await expect(
        viewerModule.getRowsWithPagination(mockPersistenceModule, metrics)
      ).rejects.toThrow("Stream read failed");

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching rows"),
        "error",
        "getRowsWithPagination",
        "viewer-native"
      );
    });

    it("should handle zero totalRows gracefully", async () => {
      const metrics = createMockFileMetrics({ totalRows: 0 });

      mockPersistenceModule.getRowsStream.mockReturnValue(createMockReadableStream([]));
      mockPersistenceModule.getErrorsStream.mockReturnValue(createMockReadableStream([]));

      const result = await viewerModule.getRowsWithPagination(mockPersistenceModule, metrics);

      expect(result.totalPages).toBe(0);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("editRow", () => {
    it("should update row field value", async () => {
      const row = createMockRowObject({
        __rowId: 1,
        value: { name: "John", email: "john@test.com" },
      });
      mockPersistenceModule.getRowById.mockResolvedValue(row);

      const payload: EditRowPayload = {
        rowId: 1,
        headerKeyEdited: "name",
        newValue: "Jane",
      };

      await viewerModule.editRow(mockPersistenceModule, payload);

      expect(mockPersistenceModule.updateRow).toHaveBeenCalledWith(
        expect.objectContaining({
          __rowId: 1,
          value: { name: "Jane", email: "john@test.com" },
          __isError: null,
        })
      );
    });

    it("should clear error flag on edit", async () => {
      const row = createMockRowObject({ __rowId: 1, __isError: "PREVIOUS_ERROR" });
      mockPersistenceModule.getRowById.mockResolvedValue(row);

      const payload: EditRowPayload = {
        rowId: 1,
        headerKeyEdited: "name",
        newValue: "Updated",
      };

      await viewerModule.editRow(mockPersistenceModule, payload);

      expect(row.__isError).toBe(null);
    });

    it("should throw error if row not found", async () => {
      mockPersistenceModule.getRowById.mockResolvedValue(null);

      const payload: EditRowPayload = {
        rowId: 999,
        headerKeyEdited: "name",
        newValue: "Jane",
      };

      await expect(viewerModule.editRow(mockPersistenceModule, payload)).rejects.toThrow(
        "Row 999 not found"
      );
    });

    it("should handle abort signal", async () => {
      const controller = new AbortController();
      controller.abort();

      const payload: EditRowPayload = {
        rowId: 1,
        headerKeyEdited: "name",
        newValue: "Jane",
      };

      await expect(
        viewerModule.editRow(mockPersistenceModule, payload, controller.signal)
      ).rejects.toThrow();
    });

    it("should log edit operation", async () => {
      const row = createMockRowObject({ __rowId: 42 });
      mockPersistenceModule.getRowById.mockResolvedValue(row);

      const payload: EditRowPayload = {
        rowId: 42,
        headerKeyEdited: "email",
        newValue: "newemail@test.com",
      };

      await viewerModule.editRow(mockPersistenceModule, payload);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining("Editing row 42"),
        "debug",
        "editRow",
        "viewer-native"
      );
    });

    it("should persist updated row", async () => {
      const row = createMockRowObject({ __rowId: 1, value: { name: "John" } });
      mockPersistenceModule.getRowById.mockResolvedValue(row);

      const payload: EditRowPayload = {
        rowId: 1,
        headerKeyEdited: "name",
        newValue: "Jane",
      };

      await viewerModule.editRow(mockPersistenceModule, payload);

      expect(mockPersistenceModule.updateRow).toHaveBeenCalled();
    });

    it("should throw error on persistence failure", async () => {
      const row = createMockRowObject();
      mockPersistenceModule.getRowById.mockResolvedValue(row);
      mockPersistenceModule.updateRow.mockRejectedValue(new Error("Update failed"));

      const payload: EditRowPayload = {
        rowId: 1,
        headerKeyEdited: "name",
        newValue: "Jane",
      };

      await expect(viewerModule.editRow(mockPersistenceModule, payload)).rejects.toThrow(
        "Update failed"
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining("Error editing row"),
        "error",
        "editRow",
        "viewer-native"
      );
    });

    it("should support multiple field edits", async () => {
      const row = createMockRowObject({
        __rowId: 1,
        value: { name: "John", email: "john@test.com", age: "30" },
      });
      mockPersistenceModule.getRowById.mockResolvedValue(row);

      const payload: EditRowPayload = {
        rowId: 1,
        headerKeyEdited: "age",
        newValue: "31",
      };

      await viewerModule.editRow(mockPersistenceModule, payload);

      expect(row.value.age).toBe("31");
      expect(row.value.name).toBe("John");
    });
  });

  describe("removeRow", () => {
    it("should delete row from persistence", async () => {
      const row = createMockRowObject({ __rowId: 1 });
      mockPersistenceModule.getRowById.mockResolvedValue(row);

      await viewerModule.removeRow(mockPersistenceModule, 1);

      expect(mockPersistenceModule.deleteRow).toHaveBeenCalledWith(1);
    });

    it("should delete associated errors", async () => {
      const row = createMockRowObject({ __rowId: 5 });
      mockPersistenceModule.getRowById.mockResolvedValue(row);

      await viewerModule.removeRow(mockPersistenceModule, 5);

      expect(mockPersistenceModule.deleteErrors).toHaveBeenCalledWith([5]);
    });

    it("should update metrics after removal", async () => {
      const row = createMockRowObject();
      mockPersistenceModule.getRowById.mockResolvedValue(row);

      await viewerModule.removeRow(mockPersistenceModule, 1);

      expect(mockPersistenceModule.updateMetrics).toHaveBeenCalled();
    });

    it("should log row removal", async () => {
      const row = createMockRowObject({ __rowId: 99 });
      mockPersistenceModule.getRowById.mockResolvedValue(row);

      await viewerModule.removeRow(mockPersistenceModule, 99);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining("Removing row 99"),
        "debug",
        "removeRow",
        "viewer-native"
      );
    });

    it("should handle abort signal gracefully", async () => {
      const row = createMockRowObject();
      mockPersistenceModule.getRowById.mockResolvedValue(row);
      const controller = new AbortController();
      controller.abort();

      // removeRow doesn't check abort signal at the start, so it will complete
      // This test verifies it doesn't crash with an aborted signal
      await viewerModule.removeRow(mockPersistenceModule, 1, controller.signal);
      expect(mockPersistenceModule.deleteRow).toHaveBeenCalledWith(1);
    });

    it("should throw error on deletion failure", async () => {
      mockPersistenceModule.getRowById.mockRejectedValue(new Error("Deletion failed"));

      await expect(viewerModule.removeRow(mockPersistenceModule, 1)).rejects.toThrow(
        "Deletion failed"
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining("Error removing rows"),
        "error",
        expect.any(String),
        "viewer-native"
      );
    });

    it("should remove multiple rows sequentially", async () => {
      mockPersistenceModule.getRowById.mockResolvedValue(createMockRowObject());

      await viewerModule.removeRow(mockPersistenceModule, 1);
      await viewerModule.removeRow(mockPersistenceModule, 2);

      expect(mockPersistenceModule.deleteRow).toHaveBeenCalledTimes(2);
      expect(mockPersistenceModule.deleteRow).toHaveBeenNthCalledWith(1, 1);
      expect(mockPersistenceModule.deleteRow).toHaveBeenNthCalledWith(2, 2);
    });

    it("should handle removal of non-existent row gracefully", async () => {
      mockPersistenceModule.getRowById.mockResolvedValue(null);

      await viewerModule.removeRow(mockPersistenceModule, 999);

      expect(mockPersistenceModule.deleteRow).toHaveBeenCalledWith(999);
    });
  });

  describe("Integration tests", () => {
    it("should handle pagination, edit, and deletion workflow", async () => {
      const metrics = createMockFileMetrics({ totalRows: 100 });
      const rows = [createMockRowObject({ __rowId: 1, value: { name: "John" } })];
      const errors = [];

      mockPersistenceModule.getRowsStream.mockReturnValue(
        createMockReadableStream([{ rows, progress: 100, bytesProcessed: 1024 }])
      );
      mockPersistenceModule.getErrorsStream.mockReturnValue(
        createMockReadableStream([{ errors, progress: 100, bytesProcessed: 512 }])
      );
      mockPersistenceModule.getRowById.mockResolvedValue(rows[0]);

      const paginationResult = await viewerModule.getRowsWithPagination(
        mockPersistenceModule,
        metrics
      );
      expect(paginationResult.rows).toHaveLength(1);

      const editPayload: EditRowPayload = {
        rowId: 1,
        headerKeyEdited: "name",
        newValue: "Jane",
      };

      await viewerModule.editRow(mockPersistenceModule, editPayload);
      expect(mockPersistenceModule.updateRow).toHaveBeenCalled();

      await viewerModule.removeRow(mockPersistenceModule, 1);
      expect(mockPersistenceModule.deleteRow).toHaveBeenCalledWith(1);
    });

    it("should maintain state across multiple operations", async () => {
      const row = createMockRowObject({ __rowId: 1, value: { status: "pending" } });
      mockPersistenceModule.getRowById.mockResolvedValue(row);

      const editPayload: EditRowPayload = {
        rowId: 1,
        headerKeyEdited: "status",
        newValue: "completed",
      };

      await viewerModule.editRow(mockPersistenceModule, editPayload);

      expect(row.value.status).toBe("completed");
      expect(row.__isError).toBeNull();
    });
  });
});
