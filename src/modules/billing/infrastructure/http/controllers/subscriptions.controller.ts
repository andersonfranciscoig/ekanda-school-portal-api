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
  SchoolScopedQueryDto,
  SubscribeBodyDto,
  SubscriptionPaymentBodyDto,
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
      'Subscrever plano pago (preferir POST /payments/checkout)',
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
        method: body.method ?? 'MULTICAIXA_EXPRESS',
        expressPhone: body.expressPhone,
      }),
      'Subscription checkout initiated',
    );
  }

  @Post(':id/renew')
  @ApiOperation({ summary: 'Renovar subscrição' })
  async renew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SubscriptionPaymentBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.renewSubscription.execute({
        actorUserId: user.id,
        subscriptionId: id,
        method: body.method ?? 'MULTICAIXA_EXPRESS',
        expressPhone: body.expressPhone,
      }),
      'Subscription renewal initiated',
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
  @ApiOperation({ summary: 'Upgrade de plano' })
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
        method: body.method ?? 'MULTICAIXA_EXPRESS',
        expressPhone: body.expressPhone,
      }),
      'Subscription upgrade initiated',
    );
  }
}
