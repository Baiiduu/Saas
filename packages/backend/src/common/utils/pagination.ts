import { IPaginationMeta } from '@saas/shared-types';

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface PaginationParams {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
}

/**
 * Calculate Prisma-compatible pagination parameters from
 * user-provided page / pageSize options.
 *
 * Ensures sane defaults (page=1, pageSize=20) and caps
 * pageSize at 100 to prevent abuse.
 */
export function getPaginationParams(options?: PaginationOptions): PaginationParams {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 20));

  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
    page,
    pageSize,
  };
}

/**
 * Wrap data array + total count into a paginated result with
 * metadata suitable for the TransformInterceptor.
 *
 * @example
 * ```ts
 * const { skip, take, page, pageSize } = getPaginationParams(query);
 * const [items, total] = await prisma.task.findMany({ skip, take, … });
 * return paginateResult(items, total, page, pageSize);
 * ```
 */
export function paginateResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): { data: T[]; meta: IPaginationMeta } {
  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Convenience wrapper: call with raw query result from Prisma's
 * `findMany` + the original options to get a response-ready object.
 *
 * @example
 * ```ts
 * const params = getPaginationParams(query);
 * const [items, count] = await Promise.all([
 *   prisma.task.findMany({ ...params, where: { teamId } }),
 *   prisma.task.count({ where: { teamId } }),
 * ]);
 * return paginate(items, count, params);
 * ```
 */
export function paginate<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): { data: T[]; meta: IPaginationMeta } {
  return paginateResult(data, total, params.page, params.pageSize);
}
