export type * from './user.ts';
export type * from './vulnerability.ts';
export type * from './scanner.ts';
export type * from './eol.ts';
export type * from './notification.ts';
export type * from './memo.ts';

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
