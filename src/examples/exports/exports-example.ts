import { RowObject } from '@/shared/schemes/row-object';
import { ReadableStream } from 'stream/web';

/**
 * Exports only name and email from the record
 */
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

/**
 * Exports complete record information with transformations
 */
export const ExportFullContact = {
  fn: (row: RowObject) => ({
    name: row.value.name?.trim() || 'N/A',
    email: row.value.email?.toLowerCase() || 'N/A',
    phone: row.value.phone || 'Sin teléfono',
    country: row.value.country?.toUpperCase() || 'UNKNOWN',
    status: row.value.active ? 'Activo' : 'Inactivo',
  }),
  labelDicc: {
    name: 'Nombre',
    email: 'Email',
    phone: 'Teléfono',
    country: 'País',
    status: 'Estado',
  },
};

/**
 * Exports only records with valid email
 */
export const ExportValidEmailsOnly = {
  fn: (row: RowObject) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.value.email)) {
      return null;
    }
    return {
      name: row.value.name,
      email: row.value.email,
    };
  },
  labelDicc: {
    name: 'Contacto',
    email: 'Dirección de Email',
  },
};

/**
 * Exports data grouped by country with callback to process and aggregate stream
 */
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
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    // Group records by country
    const countryCounts: Record<string, number> = {};
    const countryContacts: Record<string, string[]> = {};
    let processedRows = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const data = JSON.parse(decoder.decode(value));
        const country = data.country || 'Unknown';
        
        countryCounts[country] = (countryCounts[country] || 0) + 1;
        if (!countryContacts[country]) {
          countryContacts[country] = [];
        }
        countryContacts[country].push(data.email);
        processedRows++;
      }

      console.log('\n=== EXPORT SUMMARY ===');
      console.log(`Total records processed: ${processedRows}\n`);
      
      Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([country, count]) => {
          console.log(`${country}: ${count} contacts`);
          console.log(`  Emails: ${countryContacts[country]?.slice(0, 3).join(', ')}${count > 3 ? '...' : ''}`);
        });
        
      console.log('=====================\n');
    } finally {
      reader.releaseLock();
    }
  },
};

/**
 * Exports for CSV delivery with specific format
 */
export const ExportForCSV = {
  fn: (row: RowObject) => ({
    first_name: row.value.name?.split(' ')[0] || '',
    last_name: row.value.name?.split(' ').slice(1).join(' ') || '',
    email_address: row.value.email,
    phone_number: row.value.phone?.replace(/\D/g, '') || '',
    country_code: row.value.country?.substring(0, 2).toUpperCase() || '',
  }),
  labelDicc: {
    first_name: 'First Name',
    last_name: 'Last Name',
    email_address: 'Email Address',
    phone_number: 'Phone Number',
    country_code: 'Country Code',
  },
};

/**
 * Exports with stream validation and statistics
 */
export const ExportWithValidation = {
  fn: (row: RowObject) => ({
    name: row.value.name,
    email: row.value.email,
    phone: row.value.phone,
    country: row.value.country,
    hasError: row.__sError ? true : false,
    rowId: row.__rowId,
  }),
  labelDicc: {
    name: 'Nombre',
    email: 'Email',
    phone: 'Teléfono',
    country: 'País',
    hasError: 'Tiene Error',
    rowId: 'ID Registro',
  },
  callback: async (stream: ReadableStream<any>) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    const stats = {
      total: 0,
      valid: 0,
      invalid: 0,
      emailsProcessed: [] as string[],
      rowsWithErrors: [] as number[],
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const data = JSON.parse(decoder.decode(value));
        stats.total++;
        
        if (data.hasError) {
          stats.invalid++;
          stats.rowsWithErrors.push(data.rowId);
        } else {
          stats.valid++;
          if (data.email && stats.emailsProcessed.length < 5) {
            stats.emailsProcessed.push(data.email);
          }
        }
      }

      console.log('\n=== EXPORT STATISTICS ===');
      console.log(`Total: ${stats.total}`);
      console.log(`Valid: ${stats.valid} (${((stats.valid / stats.total) * 100).toFixed(1)}%)`);
      console.log(`With errors: ${stats.invalid} (${((stats.invalid / stats.total) * 100).toFixed(1)}%)`);
      
      if (stats.rowsWithErrors.length > 0) {
        console.log(`\nRecords with errors: ${stats.rowsWithErrors.join(', ')}`);
      }
      
      if (stats.emailsProcessed.length > 0) {
        console.log(`\nFirst emails processed:\n  - ${stats.emailsProcessed.join('\n  - ')}`);
      }
      console.log('========================\n');
    } finally {
      reader.releaseLock();
    }
  },
};
