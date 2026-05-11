import type { RowFilter } from "./persistent-filter";

export type ViewPaginationInfo = {
  currentPage: number;
  totalPages: number;
  currentFilter: RowFilter | null;
};
