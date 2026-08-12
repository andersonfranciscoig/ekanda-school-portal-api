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
import { GestaoRolloutService } from '../../../application/gestao-rollout.service';
import {
  GestaoWaitlistQueryDto,
  PatchGestaoModuleBodyDto,
  ReviewGestaoWaitlistBodyDto,
} from '../dto/gestao-rollout.http-dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EKANDA_ADMIN)
@ApiBearerAuth('access-token')
export class GestaoAdminController {
  constructor(private readonly gestao: GestaoRolloutService) {}

  @Get('modules/gestao')
  @ApiOperation({ summary: 'Configuração do módulo Plano Gestão' })
  async getConfig() {
    return ok(await this.gestao.getConfig(), 'Gestão module config fetched');
  }

  @Patch('modules/gestao')
  @ApiOperation({ summary: 'Actualizar fase e disponibilidade do Plano Gestão' })
  async patchConfig(@Body() body: PatchGestaoModuleBodyDto) {
    return ok(await this.gestao.updateConfig(body), 'Gestão module config updated');
  }

  @Get('gestao-waitlist')
  @ApiOperation({ summary: 'Listar fila de testes do Plano Gestão' })
  async listWaitlist(@Query() query: GestaoWaitlistQueryDto) {
    return ok(await this.gestao.listWaitlist(query), 'Gestão waitlist listed');
  }

  @Post('gestao-waitlist/:entryId/review')
  @ApiOperation({ summary: 'Aprovar ou rejeitar candidatura na fila' })
  async review(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() body: ReviewGestaoWaitlistBodyDto,
  ) {
    return ok(await this.gestao.reviewEntry(entryId, body), 'Waitlist entry reviewed');
  }
}
