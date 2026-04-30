import type { LayoutHeader } from "@schemes/layout-header";

export const ValidateLayoutHeaders = (headers: LayoutHeader[], row: any) => {
  let isValid = true;

  const missingColumns: string[] = [];
  const undefinedColumns: string[] = [];
  const repeatedColumns: string[] = [];
  let duplicatedHeaders: string[] = [];

  const rowKeys = Object.keys(row);

  if (!ValidateExistenceOfHeaders(headers, row)) {
    isValid = false;
    return {
      isValid,
      message: "Headers are not valid",
      missingColumns,
      undefinedColumns,
      repeatedColumns,
      duplicatedHeaders,
    };
  }

  duplicatedHeaders = ValidateLayoutHeadersUniqueness(headers);
  if (duplicatedHeaders.length > 0) {
    isValid = false;
    duplicatedHeaders.forEach((h) => repeatedColumns.push(h));
    return {
      isValid,
      message: "Headers are not valid",
      missingColumns,
      undefinedColumns,
      repeatedColumns,
      duplicatedHeaders,
    };
  }

  const headersToValidate = headers.map((h) => ({
    validKeys: new Set(
      h.caseSensitive
        ? [h.key, ...h.alternativeKeys]
        : [h.key.toLowerCase(), ...h.alternativeKeys.map((k) => k.toLowerCase())]
    ),
    required: h.required,
    caseSensitive: h.caseSensitive,
    id: h.key,
  }));

  headersToValidate.forEach((e) => {
    const matchedKeys = rowKeys.filter((k) =>
      e.validKeys.has(e.caseSensitive ? k : k.toLowerCase())
    );

    switch (matchedKeys.length) {
      case 0:
        if (e.required) {
          missingColumns.push(e.id);
          isValid = false;
        }
        break;
      case 1:
        break;
      default:
        repeatedColumns.push(e.id);
        isValid = false;
        break;
    }
  });

  return {
    isValid,
    message: "Headers are not valid",
    missingColumns,
    undefinedColumns,
    repeatedColumns,
    duplicatedHeaders,
  };
};

const ValidateLayoutHeadersUniqueness = (headers: LayoutHeader[]) => {
  const allKeys = headers.flatMap((h) => [
    h.key.toLowerCase(),
    ...h.alternativeKeys.map((k) => k.toLowerCase()),
  ]);

  const duplicates = allKeys.filter((item, i) => allKeys.indexOf(item) !== i);
  return [...new Set(duplicates)];
};

const ValidateExistenceOfHeaders = (headers: LayoutHeader[], row: any) => {
  return headers.length > 0;
};
