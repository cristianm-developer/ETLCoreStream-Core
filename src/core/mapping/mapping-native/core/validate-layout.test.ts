import { describe, it, expect } from 'vitest';
import { ValidateLayoutHeaders } from './validate-layout';
import { LayoutHeader } from '@shared/schemes/layout-header';

describe('ValidateLayoutHeaders', () => {
    
    const createLayoutHeader = (overrides?: Partial<LayoutHeader>): LayoutHeader => ({
        key: 'name',
        label: 'Name',
        alternativeKeys: [],
        caseSensitive: false,
        type: 'string',
        description: 'User name',
        example: 'John Doe',
        required: true,
        default: '',
        listCharacter: ',',
        order: 1,
        transforms: [],
        ...overrides
    });

    describe('Valid scenarios', () => {
        it('should validate headers when all required columns are present', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true }),
                createLayoutHeader({ key: 'email', required: true })
            ];
            const row = { name: 'John', email: 'john@example.com' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
            expect(result.missingColumns).toHaveLength(0);
            expect(result.repeatedColumns).toHaveLength(0);
            expect(result.duplicatedHeaders).toHaveLength(0);
        });

        it('should validate headers with optional columns', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true }),
                createLayoutHeader({ key: 'email', required: false })
            ];
            const row = { name: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
            expect(result.missingColumns).toHaveLength(0);
        });

        it('should validate headers with case-insensitive matching', () => {
            const headers = [
                createLayoutHeader({ key: 'name', caseSensitive: false, required: true })
            ];
            const row = { NAME: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
            expect(result.missingColumns).toHaveLength(0);
        });

        it('should validate headers with alternative keys', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'name', 
                    alternativeKeys: ['fullName', 'userName'],
                    caseSensitive: false,
                    required: true
                })
            ];
            const row = { fullName: 'John Doe' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
            expect(result.missingColumns).toHaveLength(0);
        });

        it('should validate headers with multiple alternative keys', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'firstName',
                    alternativeKeys: ['first_name', 'fname'],
                    caseSensitive: false,
                    required: true
                })
            ];
            const row = { fname: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
        });

        it('should validate multiple headers with alternative keys', () => {
            const headers = [
                createLayoutHeader({
                    key: 'firstName',
                    alternativeKeys: ['first_name'],
                    caseSensitive: false,
                    required: true
                }),
                createLayoutHeader({
                    key: 'lastName',
                    alternativeKeys: ['last_name'],
                    caseSensitive: false,
                    required: true
                })
            ];
            const row = { first_name: 'John', last_name: 'Doe' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
            expect(result.missingColumns).toHaveLength(0);
            expect(result.repeatedColumns).toHaveLength(0);
        });

        it('should validate headers with case-sensitive matching when enabled', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'name', 
                    caseSensitive: true,
                    required: true
                })
            ];
            const row = { name: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
        });

        it('should validate row with extra columns not in headers', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true })
            ];
            const row = { name: 'John', age: 30, email: 'john@example.com' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
            expect(result.missingColumns).toHaveLength(0);
        });
    });

    describe('Invalid scenarios - Missing required columns', () => {
        it('should invalidate when required column is missing', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true }),
                createLayoutHeader({ key: 'email', required: true })
            ];
            const row = { name: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.missingColumns).toContain('email');
            expect(result.message).toBe('Headers are not valid');
        });

        it('should track all missing required columns', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true }),
                createLayoutHeader({ key: 'email', required: true }),
                createLayoutHeader({ key: 'phone', required: true })
            ];
            const row = {};

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.missingColumns).toEqual(['name', 'email', 'phone']);
        });

        it('should not report optional columns as missing', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true }),
                createLayoutHeader({ key: 'email', required: false })
            ];
            const row = { name: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
            expect(result.missingColumns).toHaveLength(0);
        });

        it('should fail case-sensitive matching when key case does not match', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'name', 
                    caseSensitive: true,
                    required: true
                })
            ];
            const row = { NAME: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.missingColumns).toContain('name');
        });

        it('should fail when alternative key does not match', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'name',
                    alternativeKeys: ['fullName'],
                    caseSensitive: false,
                    required: true
                })
            ];
            const row = { userName: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.missingColumns).toContain('name');
        });
    });

    describe('Invalid scenarios - Repeated columns', () => {
        it('should invalidate when a header matches multiple row keys', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true })
            ];
            const row = { name: 'John', NAME: 'Jane' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.repeatedColumns).toContain('name');
        });

        it('should detect repeated columns with case-insensitive matching', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'email',
                    caseSensitive: false,
                    required: true
                })
            ];
            const row = { email: 'john@example.com', EMAIL: 'jane@example.com' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.repeatedColumns).toContain('email');
        });

        it('should handle multiple repeated columns', () => {
            const headers = [
                createLayoutHeader({ key: 'name', caseSensitive: false, required: true }),
                createLayoutHeader({ key: 'email', caseSensitive: false, required: true })
            ];
            const row = { 
                name: 'John', 
                NAME: 'Jane', 
                email: 'john@example.com',
                EMAIL: 'jane@example.com'
            };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.repeatedColumns).toContain('name');
            expect(result.repeatedColumns).toContain('email');
        });

        it('should detect repeated columns when alternative keys match multiple row keys', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'name',
                    alternativeKeys: ['fullName'],
                    caseSensitive: false,
                    required: true
                })
            ];
            const row = { name: 'John', fullName: 'John Doe' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.repeatedColumns).toContain('name');
        });
    });

    describe('Invalid scenarios - Duplicated headers', () => {
        it('should invalidate when headers have duplicate keys', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true }),
                createLayoutHeader({ key: 'name', required: true })
            ];
            const row = { name: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.duplicatedHeaders).toContain('name');
        });

        it('should detect duplicate headers with case-insensitive comparison', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true }),
                createLayoutHeader({ key: 'NAME', required: true })
            ];
            const row = { name: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.duplicatedHeaders.length).toBeGreaterThan(0);
        });

        it('should detect duplicate headers when alternative key matches another header key', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'name',
                    alternativeKeys: ['fullName'],
                    required: true
                }),
                createLayoutHeader({ 
                    key: 'fullName',
                    alternativeKeys: [],
                    required: true
                })
            ];
            const row = { name: 'John', fullName: 'John Doe' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.duplicatedHeaders.length).toBeGreaterThan(0);
        });

        it('should detect multiple duplicate headers', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true }),
                createLayoutHeader({ key: 'name', required: true }),
                createLayoutHeader({ key: 'email', required: true }),
                createLayoutHeader({ key: 'email', required: true })
            ];
            const row = { name: 'John', email: 'john@example.com' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.duplicatedHeaders.length).toBeGreaterThanOrEqual(2);
        });

        it('should update repeatedColumns array when duplicated headers are found', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true }),
                createLayoutHeader({ key: 'name', required: true })
            ];
            const row = { name: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.repeatedColumns).toContain('name');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty headers array', () => {
            const headers: LayoutHeader[] = [];
            const row = { name: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
        });

        it('should handle empty row object', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true })
            ];
            const row = {};

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.missingColumns).toContain('name');
        });

        it('should handle row with null values', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true })
            ];
            const row = { name: null };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
        });

        it('should handle row with undefined values', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true })
            ];
            const row = { name: undefined };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
        });

        it('should handle row with empty string values', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true })
            ];
            const row = { name: '' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
        });

        it('should handle row with numeric values', () => {
            const headers = [
                createLayoutHeader({ key: 'age', required: true })
            ];
            const row = { age: 25 };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
        });

        it('should handle row with boolean values', () => {
            const headers = [
                createLayoutHeader({ key: 'active', required: true })
            ];
            const row = { active: true };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
        });

        it('should handle special characters in keys', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'first-name',
                    alternativeKeys: ['first_name'],
                    required: true
                })
            ];
            const row = { 'first-name': 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
        });

        it('should handle unicode characters in keys', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'nombre',
                    alternativeKeys: ['名前'],
                    caseSensitive: true,
                    required: true
                })
            ];
            const row = { '名前': 'Juan' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
        });

        it('should preserve order of validations - headers existence first', () => {
            const headers: LayoutHeader[] = [];
            const row = { name: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.missingColumns).toHaveLength(0);
        });
    });

    describe('Complex scenarios', () => {
        it('should validate with mixed case-sensitive and case-insensitive headers', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'name',
                    caseSensitive: false,
                    required: true
                }),
                createLayoutHeader({ 
                    key: 'Email',
                    caseSensitive: true,
                    required: true
                })
            ];
            const row = { NAME: 'John', Email: 'john@example.com' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
        });

        it('should validate with many headers and alternative keys', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'firstName',
                    alternativeKeys: ['first_name', 'fname'],
                    required: true
                }),
                createLayoutHeader({ 
                    key: 'lastName',
                    alternativeKeys: ['last_name', 'lname'],
                    required: true
                }),
                createLayoutHeader({ 
                    key: 'email',
                    alternativeKeys: ['mail', 'emailAddress', 'e-mail'],
                    required: true
                }),
                createLayoutHeader({ 
                    key: 'phone',
                    alternativeKeys: ['tel', 'telephone', 'mobilePhone'],
                    required: false
                })
            ];
            const row = { fname: 'John', last_name: 'Doe', emailAddress: 'john@example.com' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(true);
        });

        it('should fail complex scenario when one required column is missing', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'firstName',
                    alternativeKeys: ['first_name', 'fname'],
                    required: true
                }),
                createLayoutHeader({ 
                    key: 'lastName',
                    alternativeKeys: ['last_name', 'lname'],
                    required: true
                }),
                createLayoutHeader({ 
                    key: 'email',
                    required: true
                })
            ];
            const row = { fname: 'John', last_name: 'Doe' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.missingColumns).toContain('email');
        });

        it('should handle scenario with all error types', () => {
            const headers = [
                createLayoutHeader({ 
                    key: 'name',
                    alternativeKeys: ['userName'],
                    required: true
                }),
                createLayoutHeader({ 
                    key: 'email',
                    required: true
                }),
                createLayoutHeader({ 
                    key: 'phone',
                    required: false
                })
            ];
            const row = { name: 'John', NAME: 'Jane', phone: '123456' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.isValid).toBe(false);
            expect(result.missingColumns).toContain('email');
            expect(result.repeatedColumns).toContain('name');
        });
    });

    describe('Return object structure', () => {
        it('should return object with all required properties', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true })
            ];
            const row = { name: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result).toHaveProperty('isValid');
            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('missingColumns');
            expect(result).toHaveProperty('undefinedColumns');
            expect(result).toHaveProperty('repeatedColumns');
            expect(result).toHaveProperty('duplicatedHeaders');
        });

        it('should return correct message text', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true })
            ];
            const row = {};

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.message).toBe('Headers are not valid');
        });

        it('should return arrays for column error tracking', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true })
            ];
            const row = {};

            const result = ValidateLayoutHeaders(headers, row);

            expect(Array.isArray(result.missingColumns)).toBe(true);
            expect(Array.isArray(result.undefinedColumns)).toBe(true);
            expect(Array.isArray(result.repeatedColumns)).toBe(true);
            expect(Array.isArray(result.duplicatedHeaders)).toBe(true);
        });

        it('should return empty arrays when validation passes', () => {
            const headers = [
                createLayoutHeader({ key: 'name', required: true })
            ];
            const row = { name: 'John' };

            const result = ValidateLayoutHeaders(headers, row);

            expect(result.missingColumns).toEqual([]);
            expect(result.repeatedColumns).toEqual([]);
            expect(result.duplicatedHeaders).toEqual([]);
        });
    });
});
