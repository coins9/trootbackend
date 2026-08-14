import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/domain/user.entity';
import { AuthService } from './application/auth.service';
import { SocialVerifierService } from './infrastructure/social-verifier.service';
import { AppAuthController } from './presentation/app-auth.controller';
import { AdminAuthController } from './presentation/admin-auth.controller';
import { JwtStrategy } from './presentation/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.register({}), // 시크릿은 발급/검증 시점에 주입 (access·refresh 분리)
  ],
  controllers: [AppAuthController, AdminAuthController],
  providers: [AuthService, SocialVerifierService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
