import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockResponse: any;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockResponse = { status: mockStatus };
  });

  function createHost(requestOverrides?: Record<string, any>): any {
    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({
          method: 'GET',
          url: '/test',
          ...requestOverrides,
        }),
      }),
    };
  }

  describe('HttpException', () => {
    it('should return the exception status and message', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);
      filter.catch(exception, createHost());

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 404,
          message: 'Not Found',
        }),
      );
    });

    it('should include validation error details when present', () => {
      const exception = new HttpException(
        {
          statusCode: 400,
          message: ['email must be an email', 'name should not be empty'],
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
      filter.catch(exception, createHost());

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          details: ['email must be an email', 'name should not be empty'],
        }),
      );
    });

    it('should extract message from object response', () => {
      const exception = new HttpException(
        { message: 'Custom error', statusCode: 403 },
        HttpStatus.FORBIDDEN,
      );
      filter.catch(exception, createHost());

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 403,
          message: 'Custom error',
        }),
      );
    });
  });

  describe('generic Error', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should return 500 with generic message in production', () => {
      process.env.NODE_ENV = 'production';
      const exception = new Error('Database connection failed');
      filter.catch(exception, createHost());

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 500,
          message: 'Internal server error',
          details: undefined,
        }),
      );
    });

    it('should include error details in development', () => {
      process.env.NODE_ENV = 'development';
      const exception = new Error('Database connection failed');
      filter.catch(exception, createHost());

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 500,
          message: 'Internal server error',
          details: 'Database connection failed',
        }),
      );
    });
  });

  describe('unknown exception', () => {
    it('should return 500 with generic message', () => {
      const exception = 'some primitive string error';
      filter.catch(exception, createHost());

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 500,
          message: 'Internal server error',
        }),
      );
    });
  });

  it('should include a requestId in every response', () => {
    const exception = new HttpException('Test', 400);
    filter.catch(exception, createHost());

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: expect.any(String),
      }),
    );
  });
});
