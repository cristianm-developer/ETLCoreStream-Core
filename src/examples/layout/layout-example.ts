import { LayoutBase } from '@/shared/schemes/layout-base';
import { LayoutHeader } from '@/shared/schemes/layout-header';
import { LayoutLocalStep } from '@/shared/schemes/layout-local-step';
import { GlobalStep } from '@/shared/schemes/layout-global-step';

// Import local validators and transforms
import { 
  notNull, 
  notEmpty, 
  onlyNumeric, 
  regex, 
  maxLength, 
  minLength 
} from 'examples/steps/local/validators/local-validators';

import {
  trim,
  diccTransform,
  extractDigits,
  boolResult,
  clear
} from 'examples/steps/local/transforms/local-transforms';

// Import global validators and transforms
import { AsyncValidateDataExample } from 'examples/steps/global/validators/global-validators';
import { AsyncTransformDataExample } from 'examples/steps/global/transforms/global-transforms';

// Import exports examples
import {
  ExportJustNameAndEmail,
  ExportFullContact,
  ExportValidEmailsOnly,
  ExportGroupedByCountry,
  ExportForCSV,
  ExportWithValidation,
} from 'examples/exports/exports-example';

/**
 * Example layout demonstrating a contact ETL pipeline
 * Processes contact data with multiple validation and transformation steps
 */
export const ContactManagementLayout: LayoutBase = {
  id: 'contact-management-layout-v1',
  name: 'Contact Management Layout',
  description: 'Complete ETL layout for processing contact information with validation and transformations',
  allowUndefinedColumns: false,

  headers: [
    {
      key: 'name',
      label: 'Full Name',
    },
    {
      key: 'email',
      label: 'Email Address',
    },
    {
      key: 'phone',
      label: 'Phone Number',
    },
    {
      key: 'country',
      label: 'Country',
    },
    {
      key: 'active',
      label: 'Active Status',
    },
  ] as LayoutHeader[],

  localSteps: [
    {
      id: 'name-processing',
      name: 'Name Processing',
      description: 'Clean, trim, and validate name field',
      order: ['transforms', 'validators'],
      transforms: [trim('name')],
      validators: [minLength('name', 2), maxLength('name', 100)],
    },
    {
      id: 'email-processing',
      name: 'Email Processing',
      description: 'Validate email format',
      order: ['transforms', 'validators'],
      transforms: [trim('email')],
      validators: [regex('email', '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', 'i'), minLength('email', 5)],
    },
    {
      id: 'phone-processing',
      name: 'Phone Processing',
      description: 'Extract digits and validate length',
      order: ['transforms', 'validators'],
      transforms: [trim('phone'), extractDigits('phone')],
      validators: [minLength('phone', 7)],
    },
    {
      id: 'country-processing',
      name: 'Country Processing',
      description: 'Validate and clean country field',
      order: ['transforms', 'validators'],
      transforms: [trim('country')],
      validators: [notEmpty('country')],
    },
    {
      id: 'active-status-processing',
      name: 'Active Status Processing',
      description: 'Convert to boolean status',
      order: ['transforms'],
      transforms: [
        boolResult('active', (value) => {
          const normalizedValue = String(value).toLowerCase().trim();
          return normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes';
        }),
      ],
    },
  ] as LayoutLocalStep[],

  globalSteps: [
    {
      name: 'Global Validation Step',
      order: ['validators'],
      reprocessAllRowsOnChange: true,
      filter: {
        rows: { withErrors: false },
        errors: {},
      },
      validators: [AsyncValidateDataExample()],
    },
    {
      name: 'Global Transform Step',
      order: ['transforms'],
      reprocessAllRowsOnChange: false,
      filter: {
        rows: { withErrors: false },
        errors: {},
      },
      transforms: [AsyncTransformDataExample()],
    },
  ] as GlobalStep[],

  exports: {
    nameAndEmail: ExportJustNameAndEmail,
    fullContact: ExportFullContact,
    validEmailsOnly: ExportValidEmailsOnly,
    groupedByCountry: ExportGroupedByCountry,
    csvFormat: ExportForCSV,
    withValidation: ExportWithValidation,
  },
};

/**
 * Alternative layout example with minimal processing
 * Useful for simple data passthrough scenarios
 */
export const MinimalLayout: LayoutBase = {
  id: 'minimal-layout-v1',
  name: 'Minimal Contact Layout',
  description: 'Minimal layout with basic cleaning and validation',
  allowUndefinedColumns: true,

  headers: [
    {
      key: 'name',
      label: 'Name',
    },
    {
      key: 'email',
      label: 'Email',
    },
  ] as LayoutHeader[],

  localSteps: [
    {
      id: 'name-validation',
      name: 'Name Validation',
      description: 'Clean and validate name field',
      order: ['transforms', 'validators'],
      transforms: [trim('name')],
      validators: [notEmpty('name'), minLength('name', 2), maxLength('name', 100)],
    },
    {
      id: 'email-validation',
      name: 'Email Validation',
      description: 'Clean and validate email field',
      order: ['transforms', 'validators'],
      transforms: [trim('email')],
      validators: [
        regex('email', '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'),
        minLength('email', 5),
      ],
    },
  ] as LayoutLocalStep[],

  globalSteps: [],

  exports: {
    basic: ExportJustNameAndEmail,
  },
};

/**
 * Advanced layout example with multiple validation and export strategies
 * Demonstrates complex processing pipeline with callbacks
 */
export const AdvancedLayout: LayoutBase = {
  id: 'advanced-layout-v1',
  name: 'Advanced Contact Processing Layout',
  description: 'Advanced layout with comprehensive validation, transformation, and multi-strategy exports',
  allowUndefinedColumns: false,

  headers: [
    {
      key: 'name',
      label: 'Full Name',
    },
    {
      key: 'email',
      label: 'Email Address',
    },
    {
      key: 'phone',
      label: 'Phone Number',
    },
    {
      key: 'country',
      label: 'Country Code',
    },
    {
      key: 'active',
      label: 'Status',
    },
  ] as LayoutHeader[],

  localSteps: [
    {
      id: 'name-processing-adv',
      name: 'Name Processing',
      description: 'Clean, normalize, and validate name field',
      order: ['transforms', 'validators'],
      transforms: [trim('name')],
      validators: [
        regex('name', '^[a-zA-Z\\s]{2,100}$', 'i'),
        notNull('name'),
      ],
    },
    {
      id: 'email-processing-adv',
      name: 'Email Processing',
      description: 'Clean and strictly validate email format',
      order: ['transforms', 'validators'],
      transforms: [trim('email')],
      validators: [
        regex('email', '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'),
        notNull('email'),
        notEmpty('email'),
      ],
    },
    {
      id: 'phone-processing-adv',
      name: 'Phone Processing',
      description: 'Extract digits and validate phone length',
      order: ['transforms', 'validators'],
      transforms: [trim('phone'), extractDigits('phone')],
      validators: [minLength('phone', 7), maxLength('phone', 15)],
    },
    {
      id: 'country-processing-adv',
      name: 'Country Processing',
      description: 'Normalize country names to codes',
      order: ['transforms', 'validators'],
      transforms: [
        trim('country'),
        diccTransform('country', {
          'united states': 'US',
          'united kingdom': 'UK',
          'mexico': 'MX',
          'canada': 'CA',
          'españa': 'ES',
          'brasil': 'BR',
        }),
      ],
      validators: [minLength('country', 2), maxLength('country', 2)],
    },
    {
      id: 'active-processing-adv',
      name: 'Active Status Processing',
      description: 'Convert status to boolean',
      order: ['transforms'],
      transforms: [
        boolResult('active', (value) => {
          const val = String(value).toLowerCase().trim();
          return ['true', '1', 'yes', 'active', 'sí'].includes(val);
        }),
      ],
    },
  ] as LayoutLocalStep[],

  globalSteps: [
    {
      name: 'Global Data Validation',
      order: ['validators'],
      reprocessAllRowsOnChange: true,
      filter: {
        rows: { withErrors: false },
        errors: {},
      },
      validators: [AsyncValidateDataExample()],
    },
    {
      name: 'Global Data Transformation',
      order: ['transforms'],
      reprocessAllRowsOnChange: false,
      filter: {
        rows: { withErrors: false },
        errors: {},
      },
      transforms: [AsyncTransformDataExample()],
    },
  ] as GlobalStep[],

  exports: {
    emailsOnly: ExportValidEmailsOnly,
    fullData: ExportFullContact,
    byCountry: ExportGroupedByCountry,
    csvExport: ExportForCSV,
    validated: ExportWithValidation,
  },
};
