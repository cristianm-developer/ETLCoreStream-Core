export type LayoutHeader = {
    key: string;
    label: string;
    alternativeKeys: string[];
    caseSensitive: boolean;
    description: string;
    example?: string;
    required?: boolean;
    default?: string;
    order?: number;
}

