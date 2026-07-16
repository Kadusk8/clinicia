import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthMiddleware } from './auth.middleware';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply auth middleware to all routes.
    // It populates request.user from the Better Auth session cookie.
    // Routes that don't need auth (webhooks, health) simply won't have request.user.
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
