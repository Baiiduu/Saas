import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extract the authenticated user from the request.
 * Optionally pass a property key to extract a specific field.
 *
 * @example
 * ```ts
 * &#64;Get('profile')
 * getProfile(@CurrentUser() user: JwtPayload) { ... }
 *
 * &#64;Get('profile/id')
 * getProfileId(@CurrentUser('sub') userId: string) { ... }
 * ```
 */

// Internal factory — exported for unit tests
export function getCurrentUser(data: string | undefined, ctx: ExecutionContext): any {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;
  return data ? user?.[data] : user;
}

export const CurrentUser = createParamDecorator(getCurrentUser);
