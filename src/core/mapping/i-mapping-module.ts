import { LayoutBase } from "@/shared/schemes/layout-base";
import { LayoutHeader } from "@/shared/schemes/layout-header";
import { Signal } from "@preact/signals-core";

export type MappingModuleOptions = {
    allowRemapColumns: boolean;
    ignoreRemapUnrequired: boolean;
    restCount?: number;
    onRemapFn?: (rowKeys: string[], headers: LayoutHeader[]) => Promise<[string, string][]>;
    preserveOriginalValue: boolean;
}

export const DEFAULT_MAP_HEADERS_OPTIONS: MappingModuleOptions = {
    allowRemapColumns: false,
    ignoreRemapUnrequired: false,
    restCount: 10000,
    preserveOriginalValue: false,
}

export interface IMappingModule {
    getProgress: () => Signal<number|null>;
    handleStream: (
        stream: ReadableStream,
        layout: LayoutBase,
        assignProgress: (progress: {label: string, value: number|null}) => void,
        totalRowEstimated: number,
        signal?: AbortSignal,
        step?: string,
        order?: number
    ) => Promise<ReadableStream>;
    
    handleRemap: (
        layout: LayoutBase,
        row: any,
        signal?: AbortSignal
    ) => Promise<[string, string][]>;
    
}
