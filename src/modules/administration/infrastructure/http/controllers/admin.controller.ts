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
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { UserRole } from '../../../../identity/domain/entities/user.entity';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { Roles } from '../../../../identity/infrastructure/auth/roles.decorator';
import { RolesGuard } from '../../../../identity/infrastructure/auth/roles.guard';
import { ApproveSchoolUseCase } from '../../../application/use-cases/approve-school.use-case';
import { CancelAdminSubscriptionUseCase } from '../../../application/use-cases/cancel-admin-subscription.use-case';
import { CreateAdminUserUseCase } from '../../../application/use-cases/create-admin-user.use-case';
import { CreateOrUpdatePlanUseCase } from '../../../application/use-cases/create-or-update-plan.use-case';
import { PatchAdminUserUseCase } from '../../../application/use-cases/patch-admin-user.use-case';
import { RejectSchoolUseCase } from '../../../application/use-cases/reject-school.use-case';
import { ViewApplicationsUseCase } from '../../../application/use-cases/view-applications.use-case';
import { ViewPaymentsUseCase } from '../../../application/use-cases/view-payments.use-case';
import { ViewPlansUseCase } from '../../../application/use-cases/view-plans.use-case';
import { ViewSchoolsUseCase } from '../../../application/use-cases/view-schools.use-case';
import { ViewSubscriptionsUseCase } from '../../../application/use-cases/view-subscriptions.use-case';
import { ViewUsersUseCase } from '../../../application/use-cases/view-users.use-case';
import { AdminApplicationsQueryDto } from '../dto/admin-applications.http-dto';
import { AdminPaymentsQueryDto } from '../dto/admin-payments.http-dto';
import { PatchAdminPlanBodyDto } from '../dto/admin-plans.http-dto';
import {
  AdminSchoolsQueryDto,
  RejectSchoolBodyDto,
} from '../dto/admin-schools.http-dto';
import { AdminSubscriptionsQueryDto } from '../dto/admin-subscriptions.http-dto';
import {
  AdminUsersQueryDto,
  CreateAdminUserBodyDto,
  PatchAdminUserBodyDto,
} from '../dto/admin-users.http-dto';

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
    private readonly viewUsers: ViewUsersUseCase,
    private readonly createAdminUser: CreateAdminUserUseCase,
    private readonly patchAdminUser: PatchAdminUserUseCase,
    private readonly viewPlans: ViewPlansUseCase,
    private readonly updatePlan: CreateOrUpdatePlanUseCase,
    private readonly viewPayments: ViewPaymentsUseCase,
    private readonly viewSubscriptions: ViewSubscriptionsUseCase,
    private readonly cancelSubscription: CancelAdminSubscriptionUseCase,
    private readonly viewApplications: ViewApplicationsUseCase,
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

  @Get('users')
  @ApiOperation({ summary: 'Listar utilizadores da plataforma' })
  async listUsers(@Query() query: AdminUsersQueryDto) {
    return ok(await this.viewUsers.execute(query), 'Users listed');
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Detalhe do utilizador (inclui memberships)' })
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.viewUsers.getById(id), 'User fetched');
  }

  @Post('users')
  @ApiOperation({
    summary: 'Criar EKANDA_ADMIN ou SCHOOL_ADMIN (sem iniciar sessão)',
  })
  async createUser(@Body() body: CreateAdminUserBodyDto) {
    return ok(await this.createAdminUser.execute(body), 'User created');
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Activar ou desactivar utilizador' })
  async patchUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PatchAdminUserBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.patchAdminUser.execute({
        actorUserId: user.id,
        userId: id,
        isActive: body.isActive,
      }),
      body.isActive ? 'User activated' : 'User deactivated',
    );
  }

  @Get('plans')
  @ApiOperation({ summary: 'Listar todos os planos (incluindo inactivos)' })
  async listPlans() {
    return ok(await this.viewPlans.execute(), 'Plans listed');
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Detalhe do plano' })
  async getPlan(@Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.viewPlans.getById(id), 'Plan fetched');
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Editar preço, textos, flags e features do plano' })
  async patchPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PatchAdminPlanBodyDto,
  ) {
    return ok(
      await this.updatePlan.execute({ planId: id, ...body }),
      'Plan updated',
    );
  }

  @Get('payments')
  @ApiOperation({ summary: 'Listar pagamentos de toda a plataforma' })
  async listPayments(@Query() query: AdminPaymentsQueryDto) {
    return ok(await this.viewPayments.execute(query), 'Payments listed');
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Detalhe do pagamento com timeline' })
  async getPayment(@Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.viewPayments.getById(id), 'Payment fetched');
  }

  @Get('subscriptions')
  @ApiOperation({
    summary:
      'Listar subscrições. status=EXPIRING_SOON = ACTIVE com daysRemaining <= 14',
  })
  async listSubscriptions(@Query() query: AdminSubscriptionsQueryDto) {
    return ok(await this.viewSubscriptions.execute(query), 'Subscriptions listed');
  }

  @Get('subscriptions/:id')
  @ApiOperation({ summary: 'Detalhe da subscrição' })
  async getSubscription(@Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.viewSubscriptions.getById(id), 'Subscription fetched');
  }

  @Post('subscriptions/:id/cancel')
  @ApiOperation({
    summary: 'Marcar cancelAtPeriodEnd (não apaga nem corta o período actual)',
  })
  async cancelAdminSubscription(@Param('id', ParseUUIDPipe) id: string) {
    return ok(
      await this.cancelSubscription.execute({ subscriptionId: id }),
      'Subscription scheduled to cancel at period end',
    );
  }

  @Get('applications')
  @ApiOperation({ summary: 'Listar candidaturas (supervisão)' })
  async listApplications(@Query() query: AdminApplicationsQueryDto) {
    return ok(await this.viewApplications.execute(query), 'Applications listed');
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Detalhe da candidatura (documentos + timeline)' })
  async getApplication(@Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.viewApplications.getById(id), 'Application fetched');
  }
}
