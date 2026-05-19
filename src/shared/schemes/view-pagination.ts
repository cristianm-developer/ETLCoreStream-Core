import type { RowFilter } from "./persistent-filter";
import type { RowObject } from "./row-object";

/**
 * Pagination info for a view: current page, total pages, and the active filter.
 */
export type ViewPaginationInfo = {
  /** Current 1-based page number being viewed. */
  currentPage: number;
  /** Total number of pages available for the current dataset. */
  totalPages: number;
  /** The filter currently applied to the view, or null if none. */
  currentFilter: RowFilter | null;
};

/**
 * Result returned when fetching a page of rows.
 */
export type GetRowsPaginatedResult = {
  /** Array of row objects for the current page. */
  rows: RowObject[];
  /** Cursor value to fetch the next page; null if there is no next page. */
  nextCursor: number | null;
  /** Cursor value to fetch the previous page; null if there is no previous page. */
  prevCursor: number | null;
  /** True if a next page exists beyond the current page. */
  hasNextPage: boolean;
  /** True if a previous page exists before the current page. */
  hasPrevPage: boolean;
};

/**
 * Options used to request a paginated set of rows.
 */
export type GetRowsPaginatedOptions = {
  /** Filter to apply when selecting rows. */
  filter: RowFilter;
  /** Maximum number of rows to return. */
  limit: number;
  /** Optional cursor indicating the starting point for the page. */
  cursor?: number | null;
  /** Direction to paginate from the cursor: 'next' for forward, 'prev' for backward. */
  direction?: "next" | "prev";
};
