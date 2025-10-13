import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TonModule } from '../ton/ton.module';

@Module({
  imports: [
    PrismaModule,
    TonModule.forRootAsync()
  ],
  controllers: [AuthController],
  providers: [AuthService]
})
export class AuthModule {}
