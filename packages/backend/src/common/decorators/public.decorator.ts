import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route handler as public (no JWT authentication required).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
