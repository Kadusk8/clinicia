import { Controller, All, Req, Res } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from './better-auth';
import { toNodeHandler } from 'better-auth/node';

@Controller('auth')
export class AuthController {
  @All('*')
  async handler(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const nodeHandler = toNodeHandler(auth);
    // Let Better Auth handle the Node req/res
    await nodeHandler(req.raw, res.raw);
  }
}
