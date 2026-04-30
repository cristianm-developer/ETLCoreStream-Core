import { describe, it, expect } from "vitest";
import { validateFile } from "./validate-file";
import { StreamConfig } from "../main";

describe("validateFile", () => {
  const defaultConfig: StreamConfig = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimetypes: [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  };

  it("should return valid when file passes all validations", () => {
    const csvContent = "name,email\nCristian,test@me.com";
    const file = new File([csvContent], "test.csv", { type: "text/csv" });

    const result = validateFile(file, defaultConfig);

    expect(result.isValid).toBe(true);
    expect(result.message).toBe("File is valid");
  });

  it("should return invalid when file is empty", () => {
    const file = new File([], "empty.csv", { type: "text/csv" });

    const result = validateFile(file, defaultConfig);

    expect(result.isValid).toBe(false);
    expect(result.message).toBe("File is empty");
  });

  it("should return invalid when file size exceeds maximum allowed size", () => {
    const largeContent = new ArrayBuffer(15 * 1024 * 1024); // 15MB
    const file = new File([largeContent], "large.csv", { type: "text/csv" });

    const result = validateFile(file, defaultConfig);

    expect(result.isValid).toBe(false);
    expect(result.message).toBe("File size exceeds the maximum allowed size");
  });

  it("should return invalid when file type is not allowed", () => {
    const csvContent = "name,email\nCristian,test@me.com";
    const file = new File([csvContent], "test.pdf", { type: "application/pdf" });

    const result = validateFile(file, defaultConfig);

    expect(result.isValid).toBe(false);
    expect(result.message).toBe("File type is not allowed");
  });

  it("should allow multiple valid file types", () => {
    const excelContent = "name,email\nCristian,test@me.com";

    const xlsxFile = new File([excelContent], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const xlsFile = new File([excelContent], "test.xls", {
      type: "application/vnd.ms-excel",
    });

    const resultXlsx = validateFile(xlsxFile, defaultConfig);
    const resultXls = validateFile(xlsFile, defaultConfig);

    expect(resultXlsx.isValid).toBe(true);
    expect(resultXls.isValid).toBe(true);
  });

  it("should validate file exactly at maximum size", () => {
    const content = new ArrayBuffer(10 * 1024 * 1024); // Exactly 10MB
    const file = new File([content], "max-size.csv", { type: "text/csv" });

    const result = validateFile(file, defaultConfig);

    expect(result.isValid).toBe(true);
    expect(result.message).toBe("File is valid");
  });

  it("should validate file just below maximum size", () => {
    const content = new ArrayBuffer(10 * 1024 * 1024 - 1); // 10MB - 1 byte
    const file = new File([content], "under-max.csv", { type: "text/csv" });

    const result = validateFile(file, defaultConfig);

    expect(result.isValid).toBe(true);
    expect(result.message).toBe("File is valid");
  });

  it("should validate small valid files", () => {
    const smallContent = "a,b\n1,2";
    const file = new File([smallContent], "small.csv", { type: "text/csv" });

    const result = validateFile(file, defaultConfig);

    expect(result.isValid).toBe(true);
    expect(result.message).toBe("File is valid");
  });

  it("should handle custom max file size configuration", () => {
    const customConfig: StreamConfig = {
      ...defaultConfig,
      maxFileSize: 1024, // 1KB
    };

    const largish = new ArrayBuffer(2 * 1024); // 2KB
    const file = new File([largish], "too-large.csv", { type: "text/csv" });

    const result = validateFile(file, customConfig);

    expect(result.isValid).toBe(false);
    expect(result.message).toBe("File size exceeds the maximum allowed size");
  });
});
