import { Controller, Post, Body, Get, Req } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    // TODO: Implement with Better Auth
    return { message: 'Login endpoint — implement with Better Auth' };
  }

  @Post('register')
  async register(
    @Body()
    body: {
      email: string;
      password: string;
      name: string;
      clinicName: string;
      clinicType: string;
    },
  ) {
    // TODO: Implement clinic + user registration
    return { message: 'Register endpoint — implement with Better Auth' };
  }

  @Get('me')
  async me(@Req() req: any) {
    // TODO: Return current user from session
    return { message: 'Me endpoint — implement with Better Auth' };
  }

  @Post('logout')
  async logout() {
    // TODO: Implement logout
    return { message: 'Logout endpoint' };
  }
}
