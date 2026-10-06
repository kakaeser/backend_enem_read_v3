import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyAppApiKey } from '../../common/app-api-key.config.js';
import { IS_PUBLIC_KEY } from '../../common/public.decorator.js';

@Injectable()
export class AppApiKeyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{ method?: string; headers: Record<string, unknown> }>();
    if (req.method === 'OPTIONS') return true;

    if (!verifyAppApiKey(req.headers['x-app-api-key'] as string | string[] | undefined)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
