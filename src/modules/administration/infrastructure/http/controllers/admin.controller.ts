import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../../../../shared/application/api-response';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { UserRole } from '../../../../identity/domain/entities/user.entity';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { Roles } from '../../../../identity/infrastructure/auth/roles.decorator';
import { RolesGuard } from '../../../../identity/infrastructure/auth/roles.guard';
import { ApproveSchoolUseCase } from '../../../application/use-cases/approve-school.use-case';
import { RejectSchoolUseCase } from '../../../application/use-cases/reject-school.use-case';
import { ViewSchoolsUseCase } from '../../../application/use-cases/view-schools.use-case';
import {
  AdminSchoolsQueryDto,
  RejectSchoolBodyDto,
} from '../dto/admin-schools.http-dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EKANDA_ADMIN)
@ApiBearerAuth('access-token')
export class AdminController {
  constructor(
    private readonly viewSchools: ViewSchoolsUseCase,
    private readonly approveSchool: ApproveSchoolUseCase,
    private readonly rejectSchool: RejectSchoolUseCase,
  ) {}

  @Get('schools')
  @ApiOperation({ summary: 'Listar colégios (filtro por estado / pesquisa)' })
  async listSchools(
    @Query() query: AdminSchoolsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.viewSchools.execute({
        actorRole: user.role,
        status: query.status,
        q: query.q,
        page: query.page,
        pageSize: query.pageSize,
      }),
      'Schools listed',
    );
  }

  @Get('schools/:id')
  @ApiOperation({ summary: 'Detalhe do colégio para revisão' })
  async getSchool(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.viewSchools.getById({
        actorRole: user.role,
        schoolId: id,
      }),
      'School fetched',
    );
  }

  @Post('schools/:id/approve')
  @ApiOperation({ summary: 'Aprovar colégio em análise' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.approveSchool.execute({
        schoolId: id,
        actorUserId: user.id,
        actorRole: user.role,
      }),
      'School approved',
    );
  }

  @Post('schools/:id/reject')
  @ApiOperation({ summary: 'Rejeitar colégio em análise' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectSchoolBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.rejectSchool.execute({
        schoolId: id,
        actorUserId: user.id,
        actorRole: user.role,
        reason: body.reason,
      }),
      'School rejected',
    );
  }
}
