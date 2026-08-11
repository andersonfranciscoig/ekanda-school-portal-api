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
import { CancelSubscriptionUseCase } from '../../../application/use-cases/cancel-subscription.use-case';
import { CreateSubscriptionUseCase } from '../../../application/use-cases/create-subscription.use-case';
import { GetCurrentSubscriptionUseCase } from '../../../application/use-cases/get-current-subscription.use-case';
import { ListSchoolSubscriptionsUseCase } from '../../../application/use-cases/list-school-subscriptions.use-case';
import { RenewSubscriptionUseCase } from '../../../application/use-cases/renew-subscription.use-case';
import { UpgradeSubscriptionUseCase } from '../../../application/use-cases/upgrade-subscription.use-case';
import {
  ExpressPhoneBodyDto,
  SchoolScopedQueryDto,
  SubscribeBodyDto,
  UpgradeSubscriptionBodyDto,
} from '../dto/billing.http-dto';

@ApiTags('subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SubscriptionsController {
  constructor(
    private readonly createSubscription: CreateSubscriptionUseCase,
    private readonly listSubscriptions: ListSchoolSubscriptionsUseCase,
    private readonly getCurrent: GetCurrentSubscriptionUseCase,
    private readonly renewSubscription: RenewSubscriptionUseCase,
    private readonly cancelSubscription: CancelSubscriptionUseCase,
    private readonly upgradeSubscription: UpgradeSubscriptionUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar subscrições da instituição' })
  async list(
    @Query() query: SchoolScopedQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.listSubscriptions.execute({
        actorUserId: user.id,
        schoolId: query.schoolId,
      }),
      'Subscriptions listed',
    );
  }

  @Get('current')
  @ApiOperation({ summary: 'Subscrição actual da instituição' })
  async current(
    @Query() query: SchoolScopedQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.getCurrent.execute({
        actorUserId: user.id,
        schoolId: query.schoolId,
      }),
      'Current subscription fetched',
    );
  }

  @Post()
  @ApiOperation({
    summary:
      'Subscrever plano pago via Multicaixa Express (confirmação automática até existir gateway)',
  })
  async subscribe(
    @Body() body: SubscribeBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.createSubscription.execute({
        actorUserId: user.id,
        schoolId: body.schoolId,
        planId: body.planId,
        expressPhone: body.expressPhone,
      }),
      'Subscription activated',
    );
  }

  @Post(':id/renew')
  @ApiOperation({ summary: 'Renovar subscrição (Express)' })
  async renew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ExpressPhoneBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.renewSubscription.execute({
        actorUserId: user.id,
        subscriptionId: id,
        expressPhone: body.expressPhone,
      }),
      'Subscription renewed',
    );
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancelar renovação no fim do período' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.cancelSubscription.execute({
        actorUserId: user.id,
        subscriptionId: id,
      }),
      'Subscription cancellation scheduled',
    );
  }

  @Post(':id/upgrade')
  @ApiOperation({ summary: 'Upgrade de plano (imediato após pagamento Express)' })
  async upgrade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpgradeSubscriptionBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.upgradeSubscription.execute({
        actorUserId: user.id,
        subscriptionId: id,
        planId: body.planId,
        expressPhone: body.expressPhone,
      }),
      'Subscription upgraded',
    );
  }
}
