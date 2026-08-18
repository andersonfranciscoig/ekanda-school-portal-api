import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { InAppNotificationService } from '../../../application/in-app-notification.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class NotificationsController {
  constructor(private readonly notifications: InAppNotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Notificações in-app do utilizador autenticado' })
  async listMine(@CurrentUser() user: AuthUser) {
    return ok(await this.notifications.listMine(user.id), 'Notifications listed');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Número de notificações por ler' })
  async unreadCount(@CurrentUser() user: AuthUser) {
    return ok(
      { count: await this.notifications.unreadCount(user.id) },
      'Unread notification count',
    );
  }

  @Get('gestao')
  @ApiOperation({ summary: 'Notificações do Plano Gestão para o utilizador autenticado' })
  async listGestao(@CurrentUser() user: AuthUser) {
    return ok(
      await this.notifications.listGestaoNotifications(user.id),
      'Gestão notifications listed',
    );
  }

  @Get('legal')
  @ApiOperation({ summary: 'Notificações jurídicas para o utilizador autenticado' })
  async listLegal(@CurrentUser() user: AuthUser) {
    return ok(
      await this.notifications.listLegalNotifications(user.id),
      'Legal notifications listed',
    );
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas as notificações como lidas' })
  async markAllRead(@CurrentUser() user: AuthUser) {
    return ok(await this.notifications.markAllRead(user.id), 'Notifications marked as read');
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar notificação como lida' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(await this.notifications.markRead(id, user.id), 'Notification marked as read');
  }
}
