import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PlatformBetaService } from './application/platform-beta.service';
import { PlatformBetaAdminController } from './infrastructure/http/controllers/platform-beta-admin.controller';
import { PlatformBetaPublicController } from './infrastructure/http/controllers/platform-beta-public.controller';

@Module({
  imports: [IdentityModule],
  controllers: [PlatformBetaPublicController, PlatformBetaAdminController],
  providers: [PlatformBetaService],
  exports: [PlatformBetaService],
})
export class PlatformBetaModule {}
