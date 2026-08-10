import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ConciergeVisitStatus } from '@prisma/client';
import { ok } from '../../../../../shared/application/api-response';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../../../identity/infrastructure/auth/optional-jwt-auth.guard';
import { CreateConciergeSessionUseCase } from '../../../application/use-cases/create-concierge-session.use-case';
import { GetConciergeSessionUseCase } from '../../../application/use-cases/get-concierge-session.use-case';
import { ListConciergeSessionsUseCase } from '../../../application/use-cases/list-concierge-sessions.use-case';
import {
  DecideConciergeVisitUseCase,
  ListMyConciergeVisitsUseCase,
  ListSchoolConciergeVisitsUseCase,
} from '../../../application/use-cases/manage-concierge-visits.use-case';
import { PatchConciergeNeedsUseCase } from '../../../application/use-cases/patch-concierge-needs.use-case';
import { ProcessConciergeTurnUseCase } from '../../../application/use-cases/process-concierge-turn.use-case';
import { SearchConciergeSessionUseCase } from '../../../application/use-cases/search-concierge-session.use-case';
import {
  GetConciergeVisitByCodeUseCase,
  ScheduleConciergeVisitUseCase,
} from '../../../application/use-cases/schedule-concierge-visit.use-case';
import {
  ConciergeSearchBodyDto,
  ConciergeTurnBodyDto,
  CreateConciergeSessionBodyDto,
  ListConciergeSessionsQueryDto,
  ListMyVisitsQueryDto,
  ListSchoolVisitsQueryDto,
  PatchConciergeNeedsBodyDto,
  RejectConciergeVisitBodyDto,
  ScheduleConciergeVisitBodyDto,
} from '../dto/concierge.http-dto';

@ApiTags('concierge')
@Controller('concierge')
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'x-device-id',
  required: false,
  description: 'Identificador do dispositivo para sessões anónimas',
})
export class ConciergeController {
  constructor(
    private readonly createSession: CreateConciergeSessionUseCase,
    private readonly listSessions: ListConciergeSessionsUseCase,
    private readonly getSession: GetConciergeSessionUseCase,
    private readonly processTurn: ProcessConciergeTurnUseCase,
    private readonly searchSession: SearchConciergeSessionUseCase,
    private readonly patchNeeds: PatchConciergeNeedsUseCase,
    private readonly scheduleVisit: ScheduleConciergeVisitUseCase,
    private readonly getVisitByCode: GetConciergeVisitByCodeUseCase,
    private readonly listSchoolVisits: ListSchoolConciergeVisitsUseCase,
    private readonly listMyVisits: ListMyConciergeVisitsUseCase,
    private readonly decideVisit: DecideConciergeVisitUseCase,
  ) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Criar sessão Concierge com mensagem de boas-vindas' })
  async create(
    @Body() body: CreateConciergeSessionBodyDto = {},
    @CurrentUser() user?: AuthUser,
    @Headers('x-device-id') deviceHeader?: string,
  ) {
    const result = await this.createSession.execute({
      userId: user?.id,
      deviceId: body.deviceId ?? deviceHeader ?? null,
    });
    return ok(result, 'Concierge session created');
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Listar histórico de sessões Concierge' })
  async list(
    @Query() query: ListConciergeSessionsQueryDto,
    @CurrentUser() user?: AuthUser,
    @Headers('x-device-id') deviceId?: string,
  ) {
    const result = await this.listSessions.execute({
      userId: user?.id,
      deviceId: deviceId ?? null,
      page: query.page,
      pageSize: query.pageSize,
    });
    return ok(result, 'Concierge sessions listed');
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Obter sessão completa (mensagens + needs + resultIds)' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthUser,
    @Headers('x-device-id') deviceId?: string,
  ) {
    const result = await this.getSession.execute({
      sessionId: id,
      userId: user?.id,
      deviceId: deviceId ?? null,
    });
    return ok(result, 'Concierge session fetched');
  }

  @Post('sessions/:id/turns')
  @ApiOperation({
    summary: 'Turno de conversa (Ollama / parser determinístico)',
  })
  async turn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConciergeTurnBodyDto,
    @CurrentUser() user?: AuthUser,
    @Headers('x-device-id') deviceId?: string,
  ) {
    const result = await this.processTurn.execute({
      sessionId: id,
      message: body.message,
      userId: user?.id,
      deviceId: deviceId ?? null,
    });
    return ok(result, 'Concierge turn processed');
  }

  @Post('sessions/:id/search')
  @ApiOperation({
    summary: 'Ranking de colégios a partir dos needs da sessão (marketplace)',
  })
  async search(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConciergeSearchBodyDto = {},
    @CurrentUser() user?: AuthUser,
    @Headers('x-device-id') deviceId?: string,
  ) {
    const result = await this.searchSession.execute({
      sessionId: id,
      userId: user?.id,
      deviceId: deviceId ?? null,
      limit: body.limit,
      relaxIfEmpty: body.relaxIfEmpty,
    });
    return ok(result, 'Concierge search completed');
  }

  @Patch('sessions/:id/needs')
  @ApiOperation({ summary: 'Ajuste manual do perfil de procura' })
  async patchSessionNeeds(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PatchConciergeNeedsBodyDto,
    @CurrentUser() user?: AuthUser,
    @Headers('x-device-id') deviceId?: string,
  ) {
    const result = await this.patchNeeds.execute({
      sessionId: id,
      userId: user?.id,
      deviceId: deviceId ?? null,
      needs: body.needs,
      runSearch: body.runSearch,
    });
    return ok(result, 'Concierge needs updated');
  }

  @Post('visits')
  @ApiOperation({ summary: 'Agendar visita a um colégio' })
  async createVisit(
    @Body() body: ScheduleConciergeVisitBodyDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const result = await this.scheduleVisit.execute({
      ...body,
      userId: user?.id,
    });
    return ok(result, 'Visit scheduled');
  }

  @Get('visits/mine')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar visitas agendadas pelo utilizador autenticado' })
  async myVisits(
    @Query() query: ListMyVisitsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.listMyVisits.execute({
      userId: user.id,
      page: query.page,
      pageSize: query.pageSize,
    });
    return ok(result, 'My visits listed');
  }

  @Get('visits/school/:schoolId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar visitas de um colégio (gestão)' })
  async schoolVisits(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Query() query: ListSchoolVisitsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.listSchoolVisits.execute({
      schoolId,
      actorUserId: user.id,
      status: query.status as ConciergeVisitStatus | undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    return ok(result, 'School visits listed');
  }

  @Post('visits/:id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Aceitar pedido de visita' })
  async confirmVisit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.decideVisit.execute({
      visitId: id,
      actorUserId: user.id,
      action: 'confirm',
    });
    return ok(result, 'Visit confirmed');
  }

  @Post('visits/:id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Rejeitar pedido de visita com motivo' })
  async rejectVisit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectConciergeVisitBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.decideVisit.execute({
      visitId: id,
      actorUserId: user.id,
      action: 'reject',
      rejectionReason: body.reason,
    });
    return ok(result, 'Visit rejected');
  }

  @Get('visits/:code')
  @ApiOperation({ summary: 'Obter visita pelo código' })
  async getVisit(@Param('code') code: string) {
    const result = await this.getVisitByCode.execute({ code });
    return ok(result, 'Visit fetched');
  }
}
