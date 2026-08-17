import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../../../../shared/application/api-response';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { GestaoRolloutService } from '../../../../gestao-rollout/application/gestao-rollout.service';
import { SchoolLegalService } from '../../../../school-legal/application/school-legal.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly gestao: GestaoRolloutService,
    private readonly legal: SchoolLegalService,
  ) {}

  @Get('gestao')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Notificações do Plano Gestão para o utilizador autenticado' })
  async listGestao(@CurrentUser() user: AuthUser) {
    return ok(
      await this.gestao.listGestaoNotifications(user.id),
      'Gestão notifications listed',
    );
  }

  @Get('legal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Notificações jurídicas para o utilizador autenticado' })
  async listLegal(@CurrentUser() user: AuthUser) {
    return ok(await this.legal.listLegalNotifications(user.id), 'Legal notifications listed');
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Marcar notificação como lida' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    try {
      return ok(await this.legal.markNotificationRead(id, user.id), 'Notification marked as read');
    } catch (error) {
      if (error instanceof NotFoundException) {
        return ok(await this.gestao.markNotificationRead(id, user.id), 'Notification marked as read');
      }
      throw error;
    }
  }
}
