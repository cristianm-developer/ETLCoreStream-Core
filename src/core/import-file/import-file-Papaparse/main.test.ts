import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImportFilePapaparseModule } from "./main";

vi.mock("papaparse", async (importOriginal) => {
  const actual = await importOriginal<typeof import("papaparse")>();
  return {
    default: {
      ...(actual as any).default,
      parse: vi.fn(),
    },
    parse: vi.fn(),
  };
});

const mockLogger = {
  log: vi.fn(),
  updateStatus: vi.fn(),
} as any;

describe("ImportFilePapaparseModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default config", () => {
    const importer = new ImportFilePapaparseModule(mockLogger);

    expect(importer.id).toBe("importFile-papaparse");
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining("initialized"),
      "debug",
      "constructor",
      importer.id
    );
  });

  it("should validate a valid file and return a data stream", () => {
    const importer = new ImportFilePapaparseModule(mockLogger, { worker: false });
    const csvContent = "name,email\nCristian,test@me.com";
    const file = new File([csvContent], "test.csv", { type: "text/csv" });

    const [stream, totalRowsEstimated] = importer.readFileStream(file);

    expect(stream).toBeDefined();
    expect(stream).toBeInstanceOf(ReadableStream);
    expect(totalRowsEstimated).toBeDefined();
  });

  it("should fail on empty file", () => {
    const importer = new ImportFilePapaparseModule(mockLogger, { worker: false });
    const file = new File([], "empty.csv", { type: "text/csv" });

    expect(() => importer.readFileStream(file)).toThrow();
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining("Validation failed: File is empty"),
      "error",
      "readFileStream",
      importer.id
    );
  });

  it("should fail on invalid file format type", () => {
    const importer = new ImportFilePapaparseModule(mockLogger, { worker: false });
    const csvContent = "name,email\nCristian,test@me.com";
    const file = new File([csvContent], "test.txt", { type: "application/pdf" });

    expect(() => importer.readFileStream(file)).toThrow();
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining("Validation failed: File type is not allowed"),
      "error",
      "readFileStream",
      importer.id
    );
  });
});
