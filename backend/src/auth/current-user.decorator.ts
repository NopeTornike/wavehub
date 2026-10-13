import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Returns the userId AuthGuard attached to the request. Only valid on routes guarded by
// AuthGuard — using it without the guard will yield undefined, not an error, so don't rely on
// this decorator alone for access control.
export const CurrentUserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.userId as string;
});
