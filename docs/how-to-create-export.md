# How to create an Export

Use the example exports in `src/examples/exports/exports-example.ts` as reference when creating a new export definition.

Core idea

- Each export is an object with at least a `fn` function that receives a `RowObject` and returns the transformed/exportable object (or `null` to skip the row).
- The system processes rows one-by-one but emits them in chunks via a stream so you can aggregate, buffer, or forward batches.
- Optionally provide a `callback` that receives the export stream (a ReadableStream) to process aggregated data (e.g., group, post to an API, or write CSV).

Minimal export shape

```typescript
export const MyExport = {
  fn: (row: RowObject) => ({
    // build the result object from the incoming row
    id: row.__rowId,
    name: row.value.name,
    email: row.value.email,
  }),
  labelDicc: {
    id: "ID",
    name: "Name",
    email: "Email",
  },
  // optional callback receives the chunked stream of serialized rows
  callback: async (stream: ReadableStream<any>) => {
    // read chunks and decide what to do (bulk API, CSV, aggregate...)
  },
};
```

Examples in the repo

- Simple mapping (returns object per row): see example `ExportJustNameAndEmail`.

```7:16:src/examples/exports/exports-example.ts
export const ExportJustNameAndEmail = {
  fn: (row: RowObject) => ({
    name: row.value.name,
    email: row.value.email,
  }),
  labelDicc: {
    name: 'Nombre Completo',
    email: 'Correo Electrónico',
  },
};
```

- Chunked stream + aggregation callback: see `ExportGroupedByCountry` which uses a `callback` to read the stream and aggregate by country before printing a summary.

```61:72:src/examples/exports/exports-example.ts
export const ExportGroupedByCountry = {
  fn: (row: RowObject) => ({
    country: row.value.country || 'Unknown',
    name: row.value.name,
    email: row.value.email,
  }),
  labelDicc: {
    country: 'País',
    name: 'Nombre del Contacto',
    email: 'Email',
  },
  callback: async (stream: ReadableStream<any>) => {
    // ...example reads and aggregates the stream...
  },
};
```

Notes and recommendations

- The `fn` you set defines the exported result type and is invoked per row. Returning `null` skips that row.
- Because the runtime uses a chunked streaming system, you get flexibility:
  - Stream rows to a remote API as they arrive. If you're exporting many records, prefer a bulk/batch endpoint on your API to reduce overhead.
  - Or collect/format into CSV in the `callback` and offer a downloadable file.
- If you expect large exports, implement batching in the `callback` (e.g., collect N rows then call a bulk API). This is more efficient than one-by-one requests.

Where to use

- Add your export definitions under `src/examples/exports/` (or your own exports folder) and register or expose them where your app's export UI selects available exports.
- Use the provided examples as templates for common cases: simple mapping, filtering (return null), CSV formatting, grouping/aggregation, and validation/statistics.

That's it — create an export by defining `fn`, add user-friendly `labelDicc`, and optionally add a `callback` to consume the stream for batching, aggregation, or file generation.

## Using a private CDN with the native exporter

If you use the native exporter and want to avoid depending on a public CDN for Streamsaver (or need a custom MITM path), provide `options.externalCdnConfig` when initializing the exporter. The native exporter will use the URLs you supply instead of fetching from the public CDN.

Example:

```ts
// pseudo example when creating the native exporter
const exporter = createNativeExporter({
  // ...other options...
  externalCdnConfig: {
    // URL to your hosted streamsaver script
    streamsaver: "https://cdn.mycompany.com/libs/streamsaver/streamsaver.min.js",
    // optional MITM path if you host the mitm page yourself
    mitmPath: "https://cdn.mycompany.com/libs/streamsaver/mitm.html",
  },
});
```

When provided, the native exporter will load Streamsaver and its MITM page from these hosts so your app doesn't rely on the public CDN.
