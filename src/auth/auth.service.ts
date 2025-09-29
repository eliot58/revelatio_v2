import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TonProofService } from '../services/ton-proof-service';
import { CheckProofRequest } from './dto/check-proof-dto';
import { TonApiService } from '../services/ton-api-service';
import { ApiResponse } from './dto/api-response';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  public async getUser(tgId: bigint) {
    return this.prisma.user.upsert({
      where: { tgId },
      update: {},
      create: { tgId },
    });
  }

  public async connect(tgId: bigint, data: any) {
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    const body = CheckProofRequest.parse(parsedData);

    const client = TonApiService.create(body.network);
    const service = new TonProofService();

    const isValidProof = await service.checkProof(body, (address) =>
      client.getWalletPublicKey(address),
    );
    if (!isValidProof) {
      throw new BadRequestException('Invalid proof');
    }

    const payloadTokenHash = body.proof.payload;
    const payloadToken = body.payloadToken;

    console.log(payloadToken)
    console.log(payloadTokenHash)

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
