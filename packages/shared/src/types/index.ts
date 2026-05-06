export type Locale = 'id' | 'en' | 'zh';

export type LocaleString = Record<Locale, string>;

export type PaginationParams = {
  page: number;
  pageSize: number;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
