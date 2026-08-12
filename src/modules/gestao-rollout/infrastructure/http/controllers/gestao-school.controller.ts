import {
  Body,
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
import { GestaoRolloutService } from '../../../application/gestao-rollout.service';
import { JoinGestaoWaitlistBodyDto } from '../dto/gestao-rollout.http-dto';

@ApiTags('schools')
@Controller('schools/:schoolId/gestao-waitlist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class GestaoSchoolController {
  constructor(private readonly gestao: GestaoRolloutService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Estado do módulo Gestão e candidatura do colégio' })
  async getMine(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.gestao.getMine(schoolId, user.id),
      'Gestão waitlist status fetched',
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Entrar na fila de testes do Plano Gestão' })
  async join(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: JoinGestaoWaitlistBodyDto,
  ) {
    return ok(
      await this.gestao.joinWaitlist({
        schoolId,
        userId: user.id,
        message: body.message,
      }),
      'Joined Gestão waitlist',
    );
  }
}
