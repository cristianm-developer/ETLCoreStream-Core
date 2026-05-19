import type { RowFilter } from "./persistent-filter";
import type { RowObject } from "./row-object";

export type ViewPaginationInfo = {
  currentPage: number;
  totalPages: number;
  currentFilter: RowFilter | null;
};

export type GetRowsPaginatedResult = {
  rows: RowObject[];
  nextCursor: number | null;
  prevCursor: number | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type GetRowsPaginatedOptions = {
  filter: RowFilter;
  limit: number;
  cursor?: number | null;
  direction?: "next" | "prev";
};
