import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RequestWithAuth } from './auth.types';
import { ConfigService } from '@nestjs/config';
import { isValid, parse } from '@telegram-apps/init-data-node';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: RequestWithAuth = context.switchToHttp().getRequest();
    const initData = this.extractInitDataFromHeader(request);

    if (!initData) throw new UnauthorizedException('initdata not provided');

    const botToken = this.config.get<string>('BOT_TOKEN');

    if (!isValid(initData, botToken!, { expiresIn: 15 * 60 })) throw new BadRequestException("Invalid init data");

    const parsed = parse(initData);

    if (!parsed.user) throw new BadRequestException('User data is missing from initData');

    request.tgId = BigInt(parsed.user.id);

    return true;
  }

  private extractInitDataFromHeader(request: RequestWithAuth): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('initData ')) return null;
    return authHeader.split(' ')[1];
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: RequestWithAuth = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) throw new UnauthorizedException('No token provided');

    const adminKey = this.configService.get<string>('ADMIN_KEY');

    if (!adminKey) {
      throw new ForbiddenException('Admin key not configured on server');
    }

    if (token !== adminKey) {
      throw new ForbiddenException('Invalid admin token');
    }

    return true;
  }

  private extractTokenFromHeader(request: RequestWithAuth): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.split(' ')[1];
  }
}
