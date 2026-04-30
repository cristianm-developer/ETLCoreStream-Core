// Example layout based on the existing schemes in `src/shared/schemes/*`
// This file is a data-only reference (no imports or explicit types) that follows
// the shape expected by `LayoutBase`, `LayoutHeader`, `LayoutLocalStep` and `GlobalStep`.

import type { LayoutBase } from "@/shared/schemes/layout-base";

export const LayoutExample: LayoutBase = {
  id: "contact-management-layout-v1",
  name: "Contact Management Layout",
  description: "Example layout for processing contact information",
  allowUndefinedColumns: false,

  // headers siguen la forma de LayoutHeader (clave mínima incluida)
  headers: [
    {
      key: "name",
      label: "Full Name",
      alternativeKeys: ["fullname", "nombre"],
      caseSensitive: false,
      description: "Full name of the contact",
      example: "Jane Doe",
      required: true,
      default: "",
      order: 1,
    },
    {
      key: "email",
      label: "Email Address",
      alternativeKeys: ["contact_email", "correo"],
      caseSensitive: false,
      description: "Primary email address",
      example: "jane@example.com",
      required: true,
      default: "",
      order: 2,
    },
    {
      key: "phone",
      label: "Phone Number",
      alternativeKeys: ["telefono", "phone_number"],
      caseSensitive: false,
      description: "Phone number (digits only)",
      example: "+1 555 1234",
      required: false,
      default: "",
      order: 3,
    },
  ],

  // localSteps respetan la forma LayoutLocalStep
  localSteps: [
    {
      id: "name-processing",
      name: "Name Processing",
      description: "Cleaning and normalization of the name field",
      order: ["transforms", "validators"] as any,
      transforms: [], // referenciar transformadores reales en implementaciones
      validators: [],
    },
    {
      id: "email-processing",
      name: "Email Processing",
      description: "Syntactic validation and cleaning of the email",
      order: ["transforms", "validators"] as any,
      transforms: [],
      validators: [],
    },
  ],

  // globalSteps follow the GlobalStep shape
  globalSteps: [
    {
      name: "Global Validation Step",
      order: ["validators"],
      reprocessAllRowsOnChange: true,
      filter: {
        rows: { withErrors: false },
        errors: {},
      },
      validators: [],
    },
  ],

  // exports: ejemplos mínimos que cumplen la forma esperada (fn + labelDicc opcional)
  exports: {
    basic: {
      fn: (row: any) => ({
        name: row?.value?.name,
        email: row?.value?.email,
      }),
      labelDicc: {
        name: "Full Name",
        email: "Email",
      },
    },
  },
};

// Ejemplo de header a nivel de sección, expresado según los campos usados en la UI
export const JobsSectionHeader = {
  key: "jobs-section",
  label: "Jobs — Active",
  alternativeKeys: [],
  caseSensitive: false,
  description: "Header for the jobs section",
  example: "",
  required: false,
  default: "",
  order: 0,
  // UI metadata used as reference (not part of the schema)
  ui: {
    breadcrumbs: ["Home", "Jobs", "Active"],
    primaryActions: ["Run all", "Create job"],
    secondaryActions: ["Export", "Help"],
    compactHint: false,
  },
};
