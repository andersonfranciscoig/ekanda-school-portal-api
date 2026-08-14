import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IdentityModule } from '../identity/identity.module';
import { MailModule } from '../mail/mail.module';
import { PlatformBetaService } from './application/platform-beta.service';
import { PlatformBetaAdminController } from './infrastructure/http/controllers/platform-beta-admin.controller';
import { PlatformBetaPublicController } from './infrastructure/http/controllers/platform-beta-public.controller';

@Module({
  imports: [MailModule, IdentityModule],
  controllers: [PlatformBetaPublicController, PlatformBetaAdminController],
  providers: [PlatformBetaService],
  exports: [PlatformBetaService],
})
export class PlatformBetaModule {}
