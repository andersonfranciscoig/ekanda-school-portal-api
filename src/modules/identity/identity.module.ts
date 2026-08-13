import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { RegisterUserUseCase, PASSWORD_HASHER, TOKEN_ISSUER } from './application/use-cases/register-user.use-case';
import { LoginUserUseCase } from './application/use-cases/login-user.use-case';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case';
import { UpdateCurrentUserUseCase } from './application/use-cases/update-current-user.use-case';
import { PrismaUserRepository } from './infrastructure/persistence/prisma/prisma-user.repository';
import { BcryptPasswordHasher } from './infrastructure/auth/bcrypt-password.hasher';
import { JwtTokenIssuer } from './infrastructure/auth/jwt-token.issuer';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './infrastructure/auth/optional-jwt-auth.guard';
import { RolesGuard } from './infrastructure/auth/roles.guard';
import { AuthController } from './infrastructure/http/controllers/auth.controller';
import { UsersController } from './infrastructure/http/controllers/users.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    RegisterUserUseCase,
    LoginUserUseCase,
    GetCurrentUserUseCase,
    UpdateCurrentUserUseCase,
    JwtStrategy,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    PassportModule,
    JwtModule,
    GetCurrentUserUseCase,
    USER_REPOSITORY,
    PASSWORD_HASHER,
  ],
})
export class IdentityModule {}
