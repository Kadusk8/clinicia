import { Controller, All, Req, Res } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from './better-auth';

@Controller('auth')
export class AuthController {
  @All('*')
  async handler(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    // Build an absolute URL from BETTER_AUTH_URL + the original path
    const base = process.env.BETTER_AUTH_URL || 'http://localhost:3001';
    const url = new URL(req.url, base);

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((val) => headers.append(k, val));
      else if (v != null) headers.set(k, String(v));
    }

    // Fastify already parsed the body; re-serialize it so Better Auth receives it.
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body: hasBody && req.body != null ? JSON.stringify(req.body) : undefined,
    });

    const response = await auth.handler(request);

    // Set-Cookie must be handled separately (multiple values)
    const setCookies = response.headers.getSetCookie?.() ?? [];
    if (setCookies.length) res.header('set-cookie', setCookies);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') res.header(key, value);
    });

    // Send through the Fastify reply so the @fastify/cors onSend hook applies CORS headers
    res.status(response.status);
    const text = await response.text();
    res.send(text || null);
  }
}
