import { Body, Controller, Post, HttpCode, UseGuards, Req, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { RequestWithAuth } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Get('user')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getUser(
    @Req() request: RequestWithAuth
  ) {
    return await this.authService.getUser(request.tgId);
  }

  @HttpCode(200)
  @Post('connect')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async connect(
    @Req() request: RequestWithAuth,
    @Body() data: any
  ) {
    return await this.authService.connect(request.tgId, data);
  }

  @HttpCode(200)
  @Post('disconnect')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async disconnect(
    @Req() request: RequestWithAuth
  ) {
    return await this.authService.disconnect(request.tgId);
  }
}
