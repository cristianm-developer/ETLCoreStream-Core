import { GlobalStepValidator } from "@/shared/schemes/global-step-validator";
import { ValidationError } from "@/shared/schemes/local-step-validators";
import { RowObject } from "@/shared/schemes/row-object";


export const AsyncValidateDataExample = (): GlobalStepValidator => ({
    headerKey: 'headerKey',
    name: 'AsyncValidateDataExample',
    fn: async (rows: RowObject[], ...args: any[]) => {
        const validationResults = await validateDataExample(
            rows.map(row => ({ id: row.__rowId, value: row.value['headerKey'], row }))
        );

        const validationErrors: ValidationError[] = validationResults
            .filter(result => !result.isValid)
            .map(result => ({
                __rowId: result.id,
                headerKey: 'headerKey', 
                validationCode: result.validationCode,
                message: result.message || 'Error de validación',
                value: result.value,
                originalValue: result.originalValue,
                step: 'AsyncValidateDataExample'
            }));

        return { validationErrors, removedValidationErrors: [] };
    }
});

const validateDataExample = async (
    items: { id: number; value: string; row: any }[]
): Promise<{
    id: number;
    isValid: boolean;
    validationCode: string;
    message?: string;
    value?: string;
    originalValue?: string;
}[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const results = items.map(item => {
                const value = item.value?.trim() || '';
                const isValid = value.length >= 3 && /^[a-zA-Z0-9]+$/.test(value);

                return {
                    id: item.id,
                    isValid,
                    validationCode: isValid ? 'VALID' : 'INVALID_FORMAT',
                    message: isValid ? undefined : 'El valor debe tener al menos 3 caracteres alfanuméricos',
                    value: value,
                    originalValue: item.value
                };
            });
            resolve(results);
        }, 1000);
    });
};
