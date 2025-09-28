import { JwtService } from '@nestjs/jwt';
import { AuthToken, PayloadToken } from './jwt.interface';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CHAIN } from '@tonconnect/ui-react';
import { TonProofService } from '../services/ton-proof-service';
import { sha256 } from '@ton/crypto';
import { CheckProofRequest } from './dto/check-proof-dto';
import { TonApiService } from '../services/ton-api-service';
import { isValid, parse } from '@telegram-apps/init-data-node';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) { }

  public async generateToken(
    payload: AuthToken | PayloadToken,
    expirationTime: string,
  ): Promise<string> {
    return await this.jwtService.signAsync(payload, {
      expiresIn: expirationTime,
    });
  }

  public async generateAuthToken(
    address: string,
    network: CHAIN,
  ): Promise<string> {
    const payload: AuthToken = { address, network };
    return this.generateToken(payload, '1y');
  }

  public async generatePayloadToken(randomBytes: string): Promise<string> {
    const payload: PayloadToken = { randomBytes };
    return this.generateToken(payload, '15m');
  }

  public async verifyToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      return payload;
    } catch (error) {
      return null;
    }
  }

  public async generatePayload() {
    const service = new TonProofService();

    const randomBytes = await service.generateRandomBytes();
    const payloadToken = await this.generatePayloadToken(
      randomBytes.toString('hex'),
    );
    const payloadTokenHash = (await sha256(payloadToken)).toString('hex');

    return {
      payloadToken: payloadToken,
      payloadTokenHash: payloadTokenHash,
    };
  }

  public async checkProof(data: any, initData: string) {
    const botToken = this.config.get<string>('BOT_TOKEN');

    if (!isValid(initData, botToken!)) throw new BadRequestException("Invalid init data");

    const parsed = parse(initData);

    if (!parsed.user) throw new BadRequestException('User data is missing from initData');

    const tgId = BigInt(parsed.user.id);

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

    if (!(await this.verifyToken(payloadToken))) {
      throw new BadRequestException('Invalid token');
    }

    if ((await sha256(payloadToken)).toString('hex') !== payloadTokenHash) {
      throw new BadRequestException('Invalid payload token hash');
    }

    await this.prisma.$transaction(async (tx) => {
      const [uByWallet, uByTg] = await Promise.all([
        tx.user.findUnique({ where: { wallet: body.address } }),
        tx.user.findUnique({ where: { tgId } }),
      ]);

      if (!uByWallet && !uByTg) {
        await tx.user.create({
          data: { tgId, wallet: body.address },
        });
      }

      if (uByWallet && !uByTg) {
        if (uByWallet.tgId !== tgId) {
          await tx.user.update({
            where: { wallet: body.address },
            data: { tgId },
          });
        }
      }

      if (!uByWallet && uByTg) {
        if (uByTg.wallet !== body.address) {
          await tx.user.update({
            where: { tgId },
            data: { wallet: body.address },
          });
        }
      }

    });

    const token = await this.generateAuthToken(body.address, body.network);

    return { token };
  }
}
