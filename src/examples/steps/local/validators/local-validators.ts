import { LocalStepValidator } from '@shared/schemes/local-step-validators';

/**
 * Validator: Verifies that the value is not null/undefined
 */
export const notNull = (headerKey: string): LocalStepValidator => ({
    headerKey,
    name: 'Not Null',
    fn: (value: string, row: any) => ({
        isValid: value !== null && value !== undefined,
        validationCode: 'NOT_NULL',
        message: value === null || value === undefined ? 'Value cannot be null' : undefined,
        value,
        step: 'local',
    }),
});

/**
 * Validator: Verifies that the value contains only numeric characters
 */
export const onlyNumeric = (headerKey: string): LocalStepValidator => ({
    headerKey,
    name: 'Only Numeric',
    fn: (value: string, row: any) => {
        const isValid = /^\d+$/.test(value);
        return {
            isValid,
            validationCode: 'ONLY_NUMERIC',
            message: !isValid ? 'Value must contain only numeric characters' : undefined,
            value,
            step: 'local',
        };
    },
});

/**
 * Validator: Validates value against a regular expression pattern
 */
export const regex = (headerKey: string, pattern: string, flags: string = ''): LocalStepValidator => ({
    headerKey,
    name: 'Regex Pattern',
    fn: (value: string, row: any, ...args: any[]) => {
        const regexPattern: string = args[0];
        const regexFlags: string = args[1] ?? '';
        if (!regexPattern) {
            return {
                isValid: false,
                validationCode: 'REGEX_ERROR',
                message: 'Pattern is required',
                value,
                step: 'local',
            };
        }
        try {
            const regex = new RegExp(regexPattern, regexFlags);
            const isValid = regex.test(value);
            return {
                isValid,
                validationCode: 'REGEX_PATTERN',
                message: !isValid ? `Value does not match pattern: ${regexPattern}` : undefined,
                value,
                step: 'local',
            };
        } catch (error) {
            return {
                isValid: false,
                validationCode: 'REGEX_ERROR',
                message: `Invalid regex pattern: ${(error as Error).message}`,
                value,
                step: 'local',
            };
        }
    },
    args: [pattern, flags],
});

/**
 * Validator: Verifies that the value length does not exceed a maximum
 */
export const maxLength = (headerKey: string, max: number): LocalStepValidator => ({
    headerKey,
    name: 'Max Length',
    fn: (value: string, row: any, ...args: any[]) => {
        const maxLen: number = args[0];
        if (maxLen === undefined || maxLen === null) {
            return {
                isValid: false,
                validationCode: 'MAX_LENGTH_ERROR',
                message: 'Max length is required',
                value,
                step: 'local',
            };
        }
        const isValid = value.length <= maxLen;
        return {
            isValid,
            validationCode: 'MAX_LENGTH',
            message: !isValid ? `Value exceeds maximum length of ${maxLen}` : undefined,
            value,
            step: 'local',
        };
    },
    args: [max],
});

/**
 * Validator: Verifies that the value length meets a minimum
 */
export const minLength = (headerKey: string, min: number): LocalStepValidator => ({
    headerKey,
    name: 'Min Length',
    fn: (value: string, row: any, ...args: any[]) => {
        const minLen: number = args[0];
        if (minLen === undefined || minLen === null) {
            return {
                isValid: false,
                validationCode: 'MIN_LENGTH_ERROR',
                message: 'Min length is required',
                value,
                step: 'local',
            };
        }
        const isValid = value.length >= minLen;
        return {
            isValid,
            validationCode: 'MIN_LENGTH',
            message: !isValid ? `Value is below minimum length of ${minLen}` : undefined,
            value,
            step: 'local',
        };
    },
    args: [min],
});

/**
 * Validator: Verifies that the value is not empty (after trimming whitespace)
 */
export const notEmpty = (headerKey: string): LocalStepValidator => ({
    headerKey,
    name: 'Not Empty',
    fn: (value: string, row: any) => {
        const isValid = value !== null && value !== undefined && value.trim().length > 0;
        return {
            isValid,
            validationCode: 'NOT_EMPTY',
            message: !isValid ? 'Value cannot be empty' : undefined,
            value,
            step: 'local',
        };
    },
});

/**
 * Validator: Verifies that a numeric value does not exceed a maximum
 */
export const maxValue = (headerKey: string, max: number): LocalStepValidator => ({
    headerKey,
    name: 'Max Value',
    fn: (value: string, row: any, ...args: any[]) => {
        const maxVal: number = args[0];
        if (maxVal === undefined || maxVal === null) {
            return {
                isValid: false,
                validationCode: 'MAX_VALUE_ERROR',
                message: 'Max value is required',
                value,
                step: 'local',
            };
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            return {
                isValid: false,
                validationCode: 'MAX_VALUE_ERROR',
                message: 'Value must be a valid number',
                value,
                step: 'local',
            };
        }
        const isValid = numValue <= maxVal;
        return {
            isValid,
            validationCode: 'MAX_VALUE',
            message: !isValid ? `Value must not exceed ${maxVal}` : undefined,
            value,
            step: 'local',
        };
    },
    args: [max],
});

/**
 * Validator: Verifies that a numeric value meets a minimum
 */
export const minValue = (headerKey: string, min: number): LocalStepValidator => ({
    headerKey,
    name: 'Min Value',
    fn: (value: string, row: any, ...args: any[]) => {
        const minVal: number = args[0];
        if (minVal === undefined || minVal === null) {
            return {
                isValid: false,
                validationCode: 'MIN_VALUE_ERROR',
                message: 'Min value is required',
                value,
                step: 'local',
            };
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            return {
                isValid: false,
                validationCode: 'MIN_VALUE_ERROR',
                message: 'Value must be a valid number',
                value,
                step: 'local',
            };
        }
        const isValid = numValue >= minVal;
        return {
            isValid,
            validationCode: 'MIN_VALUE',
            message: !isValid ? `Value must be at least ${minVal}` : undefined,
            value,
            step: 'local',
        };
    },
    args: [min],
});

/**
 * Validator: Verifies that a numeric value is within a specified range
 */
export const inRange = (headerKey: string, min: number, max: number): LocalStepValidator => ({
    headerKey,
    name: 'In Range',
    fn: (value: string, row: any, ...args: any[]) => {
        const minVal: number = args[0];
        const maxVal: number = args[1];
        if (minVal === undefined || maxVal === undefined) {
            return {
                isValid: false,
                validationCode: 'IN_RANGE_ERROR',
                message: 'Min and max values are required',
                value,
                step: 'local',
            };
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            return {
                isValid: false,
                validationCode: 'IN_RANGE_ERROR',
                message: 'Value must be a valid number',
                value,
                step: 'local',
            };
        }
        const isValid = numValue >= minVal && numValue <= maxVal;
        return {
            isValid,
            validationCode: 'IN_RANGE',
            message: !isValid ? `Value must be between ${minVal} and ${maxVal}` : undefined,
            value,
            step: 'local',
        };
    },
    args: [min, max],
});

/**
 * Validator: Verifies that the value is one of the allowed values in a list
 */
export const inList = (headerKey: string, allowedValues: string[]): LocalStepValidator => ({
    headerKey,
    name: 'In List',
    fn: (value: string, row: any, ...args: any[]) => {
        const list: string[] = args[0];
        if (!list || !Array.isArray(list) || list.length === 0) {
            return {
                isValid: false,
                validationCode: 'IN_LIST_ERROR',
                message: 'Allowed values list is required',
                value,
                step: 'local',
            };
        }
        const isValid = list.includes(value);
        return {
            isValid,
            validationCode: 'IN_LIST',
            message: !isValid ? `Value must be one of: ${list.join(', ')}` : undefined,
            value,
            step: 'local',
        };
    },
    args: [allowedValues],
});

/**
 * Validator: Verifies that a numeric value is not negative
 */
export const notNegative = (headerKey: string): LocalStepValidator => ({
    headerKey,
    name: 'Not Negative',
    fn: (value: string, row: any) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            return {
                isValid: false,
                validationCode: 'NOT_NEGATIVE_ERROR',
                message: 'Value must be a valid number',
                value,
                step: 'local',
            };
        }
        const isValid = numValue >= 0;
        return {
            isValid,
            validationCode: 'NOT_NEGATIVE',
            message: !isValid ? 'Value cannot be negative' : undefined,
            value,
            step: 'local',
        };
    },
});

/**
 * Factory function to create a collection of all available local validators
 * Note: Validators that require parameters (regex, maxLength, minLength, maxValue, minValue, inRange, inList)
 * must be instantiated directly with their required arguments.
 * Example: regex(headerKey, pattern, flags), maxLength(headerKey, max), etc.
 */
export const createLocalValidators = (headerKey: string) => ({
    notNull: notNull(headerKey),
    onlyNumeric: onlyNumeric(headerKey),
    notEmpty: notEmpty(headerKey),
    notNegative: notNegative(headerKey),
});

/**
 * Collection of all available local validators (factory functions)
 */
export const LocalValidators = {
    notNull,
    onlyNumeric,
    regex,
    maxLength,
    minLength,
    notEmpty,
    maxValue,
    minValue,
    inRange,
    inList,
    notNegative,
};

export default LocalValidators;
