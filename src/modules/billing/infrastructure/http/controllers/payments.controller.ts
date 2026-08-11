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
import { ConfirmPaymentUseCase } from '../../../application/use-cases/confirm-payment.use-case';
import { GetPaymentUseCase } from '../../../application/use-cases/get-payment.use-case';
import { ListSchoolPaymentsUseCase } from '../../../application/use-cases/list-school-payments.use-case';
import { ProcessPaymentUseCase } from '../../../application/use-cases/process-payment.use-case';
import { StartPaymentUseCase } from '../../../application/use-cases/start-payment.use-case';
import {
  ConfirmPaymentBodyDto,
  PaymentWebhookBodyDto,
  SchoolScopedQueryDto,
  StartPaymentBodyDto,
} from '../dto/billing.http-dto';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly startPayment: StartPaymentUseCase,
    private readonly listPayments: ListSchoolPaymentsUseCase,
    private readonly getPayment: GetPaymentUseCase,
    private readonly confirmPayment: ConfirmPaymentUseCase,
    private readonly processPayment: ProcessPaymentUseCase,
  ) {}

  @Get('payments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar pagamentos da instituição' })
  async list(
    @Query() query: SchoolScopedQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.listPayments.execute({
        actorUserId: user.id,
        schoolId: query.schoolId,
      }),
      'Payments listed',
    );
  }

  @Get('payments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obter pagamento' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.getPayment.execute({ actorUserId: user.id, paymentId: id }),
      'Payment fetched',
    );
  }

  @Post('payments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Iniciar pagamento Multicaixa Express (confirmado automaticamente até existir gateway)',
  })
  async create(
    @Body() body: StartPaymentBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.startPayment.execute({
        actorUserId: user.id,
        schoolId: body.schoolId,
        planId: body.planId,
        subscriptionId: body.subscriptionId,
        expressPhone: body.expressPhone,
      }),
      'Payment confirmed',
    );
  }

  @Post('payments/:id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Confirmar pagamento (idempotente)' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfirmPaymentBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.confirmPayment.execute({
        paymentId: id,
        externalTransactionId: body.externalTransactionId,
        actorUserId: user.id,
      }),
      'Payment confirmation processed',
    );
  }

  @Post('webhooks/payments')
  @ApiOperation({
    summary: 'Webhook de pagamentos (idempotente; preparado para gateway futuro)',
  })
  async webhook(@Body() body: PaymentWebhookBodyDto) {
    return ok(
      await this.processPayment.execute({
        eventId: body.eventId,
        eventType: body.eventType,
        paymentId: body.paymentId,
        externalTransactionId: body.externalTransactionId,
        status: body.status,
      }),
      'Webhook processed',
    );
  }
}
