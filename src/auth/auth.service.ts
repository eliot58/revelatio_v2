import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckProofRequest } from './dto/check-proof-dto';
import { ApiResponse } from './dto/api-response';
import { TonService } from '../ton/ton.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ton: TonService
  ) { }

  public async getUser(tgId: bigint) {
    const user = await  this.prisma.user.upsert({
      where: { tgId },
      update: {},
      create: { tgId },
    });

    return {
      tgId: user.tgId.toString(),
      wallet: user.wallet
    }
  }

  public async connect(tgId: bigint, data: any) {
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    const body = CheckProofRequest.parse(parsedData);

    const isValidProof = await this.ton.checkProof(body);
    if (!isValidProof) {
      throw new BadRequestException('Invalid proof');
    }

    const payload = body.proof.payload;

    if (payload !== tgId.toString()) throw new BadRequestException('Invalid payload')

    const user = await this.prisma.user.upsert({
      where: { tgId },
      update: {},
      create: { tgId },
      select: { tgId: true, wallet: true },
    });

    if (user.wallet === body.address) {
      return {
        status: 'ok',
        code: 'ALREADY_CONNECTED',
        message: 'Wallet is already linked to this user.',
        data: { tgId: user.tgId.toString(), wallet: body.address },
      };
    }
    
    const updated = await this.prisma.user.update({
      where: { tgId: user.tgId },
      data: { wallet: body.address },
      select: { tgId: true, wallet: true },
    });

    const wasEmpty = user.wallet == null;
    return {
      status: 'ok',
      code: wasEmpty ? 'CONNECTED' : 'WALLET_UPDATED',
      message: wasEmpty ? 'Wallet linked successfully.' : 'Wallet updated successfully.',
      data: { tgId: updated.tgId.toString(), wallet: updated.wallet! },
    };
  }

  public async disconnect(tgId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { tgId }
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.wallet === null) {
      return <ApiResponse<{ tgId: string }>>{
        status: 'ok',
        code: 'ALREADY_DISCONNECTED',
        message: 'Wallet is already detached.',
        data: { tgId: user.tgId.toString() },
      };
    }

    await this.prisma.user.update({
      where: { tgId },
      data: { wallet: null },
    });

    return <ApiResponse<{ tgId: string }>>{
      status: 'ok',
      code: 'DISCONNECTED',
      message: 'Wallet detached successfully.',
      data: { tgId: user.tgId.toString() },
    };
  }
}
