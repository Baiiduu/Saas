import {
  getPaginationParams,
  paginateResult,
  paginate,
  PaginationParams,
} from './pagination';

describe('getPaginationParams', () => {
  it('should return defaults when no options provided', () => {
    const result = getPaginationParams();
    expect(result).toEqual({
      skip: 0,
      take: 20,
      page: 1,
      pageSize: 20,
    });
  });

  it('should return defaults when options are empty', () => {
    const result = getPaginationParams({});
    expect(result).toEqual({
      skip: 0,
      take: 20,
      page: 1,
      pageSize: 20,
    });
  });

  describe('page boundary values', () => {
    it('should clamp page to minimum of 1 when page is 0', () => {
      const result = getPaginationParams({ page: 0, pageSize: 10 });
      expect(result.page).toBe(1);
      expect(result.skip).toBe(0);
    });

    it('should clamp page to minimum of 1 when page is negative', () => {
      const result = getPaginationParams({ page: -5, pageSize: 10 });
      expect(result.page).toBe(1);
      expect(result.skip).toBe(0);
    });

    it('should accept valid page values', () => {
      const result = getPaginationParams({ page: 3, pageSize: 10 });
      expect(result.page).toBe(3);
      expect(result.skip).toBe(20); // (3-1) * 10
    });
  });

  describe('pageSize boundary values', () => {
    it('should clamp pageSize to minimum of 1 when pageSize is 0', () => {
      const result = getPaginationParams({ page: 1, pageSize: 0 });
      expect(result.pageSize).toBe(1);
      expect(result.take).toBe(1);
    });

    it('should clamp pageSize to minimum of 1 when pageSize is negative', () => {
      const result = getPaginationParams({ page: 1, pageSize: -1 });
      expect(result.pageSize).toBe(1);
      expect(result.take).toBe(1);
    });

    it('should cap pageSize at 100 to prevent abuse', () => {
      const result = getPaginationParams({ page: 1, pageSize: 500 });
      expect(result.pageSize).toBe(100);
      expect(result.take).toBe(100);
    });

    it('should accept valid pageSize values', () => {
      const result = getPaginationParams({ page: 1, pageSize: 50 });
      expect(result.pageSize).toBe(50);
      expect(result.take).toBe(50);
    });
  });

  it('should calculate skip correctly', () => {
    const result = getPaginationParams({ page: 5, pageSize: 15 });
    expect(result.skip).toBe(60); // (5-1) * 15
    expect(result.take).toBe(15);
  });
});

describe('paginateResult', () => {
  it('should wrap data and meta correctly', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = paginateResult(data, 25, 2, 10);

    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      meta: {
        page: 2,
        pageSize: 10,
        total: 25,
        totalPages: 3, // Math.ceil(25/10)
      },
    });
  });

  it('should handle empty data array', () => {
    const result = paginateResult([], 0, 1, 20);
    expect(result).toEqual({
      data: [],
      meta: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('should calculate totalPages as 1 when total equals pageSize', () => {
    const result = paginateResult([{ id: 1 }], 20, 1, 20);
    expect(result.meta.totalPages).toBe(1);
  });
});

describe('paginate', () => {
  it('should call paginateResult with params', () => {
    const data = [{ id: 1 }];
    const total = 50;
    const params: PaginationParams = {
      skip: 20,
      take: 20,
      page: 2,
      pageSize: 20,
    };

    const result = paginate(data, total, params);
    expect(result).toEqual({
      data: [{ id: 1 }],
      meta: {
        page: 2,
        pageSize: 20,
        total: 50,
        totalPages: 3,
      },
    });
  });
});
