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
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { SchoolAccessAuthorizer } from '../../../../school/application/services/school-access.authorizer';
import { ApproveApplicationUseCase } from '../../../application/use-cases/approve-application.use-case';
import { GetApplicationUseCase } from '../../../application/use-cases/get-application.use-case';
import { ListApplicationsUseCase } from '../../../application/use-cases/list-applications.use-case';
import { RejectApplicationUseCase } from '../../../application/use-cases/reject-application.use-case';
import {
  RejectApplicationBodyDto,
  SchoolApplicationsQueryDto,
} from '../dto/school-applications.http-dto';

@ApiTags('school-applications')
@Controller('schools/:schoolId/applications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SchoolApplicationsController {
  constructor(
    private readonly access: SchoolAccessAuthorizer,
    private readonly listApplications: ListApplicationsUseCase,
    private readonly getApplication: GetApplicationUseCase,
    private readonly approveApplication: ApproveApplicationUseCase,
    private readonly rejectApplication: RejectApplicationUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar candidaturas do colégio (membership obrigatória)',
  })
  async list(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Query() query: SchoolApplicationsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertCanManageSchool(user.id, schoolId);
    return ok(
      await this.listApplications.execute({
        schoolId,
        status: query.status,
        q: query.q,
        page: query.page,
        pageSize: query.pageSize,
        includeCounts: true,
      }),
      'Applications listed',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da candidatura do colégio' })
  async getById(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertCanManageSchool(user.id, schoolId);
    return ok(
      await this.getApplication.execute({ applicationId: id, schoolId }),
      'Application fetched',
    );
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Aceitar candidatura' })
  async accept(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.approveApplication.execute({
        actorUserId: user.id,
        schoolId,
        applicationId: id,
      }),
      'Application accepted',
    );
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Rejeitar candidatura' })
  async reject(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectApplicationBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.rejectApplication.execute({
        actorUserId: user.id,
        schoolId,
        applicationId: id,
        reason: body.reason,
      }),
      'Application rejected',
    );
  }
}
