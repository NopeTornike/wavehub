import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Returns the adminRole AdminGuard attached to the request. Only valid on routes guarded by
// AdminGuard — same caveat as CurrentUserId/AuthGuard: using it without the guard yields
// undefined, not an error.
export const CurrentAdminRole = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.adminRole as string;
});
