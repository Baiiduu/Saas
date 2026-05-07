import { of } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;
  let mockResponse: { statusCode: number };

  beforeEach(() => {
    interceptor = new TransformInterceptor();
    mockResponse = { statusCode: 200 };
  });

  function createMockContext(): ExecutionContext {
    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;
  }

  function createCallHandler(data: any): CallHandler {
    return { handle: () => of(data) };
  }

  it('should wrap a plain object with code, message, and data', (done) => {
    const data = { id: 1, name: 'test' };

    interceptor
      .intercept(createMockContext(), createCallHandler(data))
      .subscribe((result) => {
        expect(result).toEqual({
          code: 200,
          message: 'success',
          data: { id: 1, name: 'test' },
        });
        done();
      });
  });

  it('should wrap null data as null', (done) => {
    interceptor
      .intercept(createMockContext(), createCallHandler(null))
      .subscribe((result) => {
        expect(result).toEqual({
          code: 200,
          message: 'success',
          data: null,
        });
        done();
      });
  });

  it('should wrap undefined data as null', (done) => {
    interceptor
      .intercept(createMockContext(), createCallHandler(undefined))
      .subscribe((result) => {
        expect(result).toEqual({
          code: 200,
          message: 'success',
          data: null,
        });
        done();
      });
  });

  it('should pass through data that already has the API response format', (done) => {
    const alreadyFormatted = {
      code: 201,
      message: 'created',
      data: { id: 1 },
    };

    interceptor
      .intercept(createMockContext(), createCallHandler(alreadyFormatted))
      .subscribe((result) => {
        expect(result).toBe(alreadyFormatted);
        done();
      });
  });

  it('should extract meta when present and remove it from data', (done) => {
    const data = {
      items: ['a', 'b'],
      meta: { page: 1, total: 2 },
    };

    interceptor
      .intercept(createMockContext(), createCallHandler(data))
      .subscribe((result) => {
        expect(result).toEqual({
          code: 200,
          message: 'success',
          data: { items: ['a', 'b'] },
          meta: { page: 1, total: 2 },
        });
        // Ensure meta is not nested inside data
        expect((result as any).data).not.toHaveProperty('meta');
        done();
      });
  });

  describe('paginated results', () => {
    it('should unwrap paginated result to avoid nested data.data', (done) => {
      const paginatedResult = {
        data: [{ id: 1 }, { id: 2 }],
        meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      };

      interceptor
        .intercept(createMockContext(), createCallHandler(paginatedResult))
        .subscribe((result) => {
          expect(result).toEqual({
            code: 200,
            message: 'success',
            data: [{ id: 1 }, { id: 2 }],
            meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
          });
          // data should be the array directly, NOT wrapped in another object
          expect(Array.isArray((result as any).data)).toBe(true);
          done();
        });
    });

    it('should pass through non-array payload with a data property as-is', (done) => {
      // When the payload has a non-array `data` and no `meta`, it is treated
      // as a regular object and wrapped into response.data as-is.
      const nonPaginated = {
        data: { nested: true },
        extra: 'info',
      };

      interceptor
        .intercept(createMockContext(), createCallHandler(nonPaginated))
        .subscribe((result) => {
          expect(result).toEqual({
            code: 200,
            message: 'success',
            data: {
              data: { nested: true },
              extra: 'info',
            },
          });
          done();
        });
    });
  });
});
