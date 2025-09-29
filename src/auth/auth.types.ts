import { FastifyRequest } from 'fastify';

export type AuthPayload = {
  tgId: bigint;
};

export type RequestWithAuth = FastifyRequest & AuthPayload;
