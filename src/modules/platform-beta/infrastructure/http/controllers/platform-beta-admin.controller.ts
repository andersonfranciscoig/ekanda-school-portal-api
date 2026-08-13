import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../../../../shared/application/api-response';
import { UserRole } from '../../../../identity/domain/entities/user.entity';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { Roles } from '../../../../identity/infrastructure/auth/roles.decorator';
import { RolesGuard } from '../../../../identity/infrastructure/auth/roles.guard';
import { PlatformBetaService } from '../../../application/platform-beta.service';
import {
  BetaRequestsQueryDto,
  PatchPlatformSettingsBodyDto,
  ReviewBetaRequestBodyDto,
} from '../dto/platform-beta.http-dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EKANDA_ADMIN)
@ApiBearerAuth('access-token')
export class PlatformBetaAdminController {
  constructor(private readonly beta: PlatformBetaService) {}

  @Get('platform/settings')
  @ApiOperation({ summary: 'Ler settings da plataforma (admin)' })
  async getSettings() {
    return ok(await this.beta.getSettings(), 'Platform settings fetched');
  }

  @Patch('platform/settings')
  @ApiOperation({ summary: 'Actualizar beta + URL WhatsApp comunidade' })
  async patchSettings(@Body() body: PatchPlatformSettingsBodyDto) {
    return ok(await this.beta.updateSettings(body), 'Platform settings updated');
  }

  @Get('beta-requests')
  @ApiOperation({ summary: 'Listar pedidos de acesso beta' })
  async list(@Query() query: BetaRequestsQueryDto) {
    return ok(await this.beta.listRequests(query), 'Beta requests listed');
  }

  @Post('beta-requests/:id/review')
  @ApiOperation({ summary: 'Aprovar ou rejeitar pedido beta' })
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewBetaRequestBodyDto,
  ) {
    return ok(await this.beta.reviewRequest(id, body), 'Beta request reviewed');
  }
}
