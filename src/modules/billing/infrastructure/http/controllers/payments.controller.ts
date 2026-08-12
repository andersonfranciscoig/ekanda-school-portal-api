import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ok } from '../../../../../shared/application/api-response';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { ConfirmPaymentUseCase } from '../../../application/use-cases/confirm-payment.use-case';
import { GetPaymentUseCase } from '../../../application/use-cases/get-payment.use-case';
import { InitiatePaymentCheckoutUseCase } from '../../../application/use-cases/initiate-payment-checkout.use-case';
import { ListSchoolPaymentsUseCase } from '../../../application/use-cases/list-school-payments.use-case';
import { ProcessFindoraWebhookUseCase } from '../../../application/use-cases/process-findora-webhook.use-case';
import { ProcessPaymentUseCase } from '../../../application/use-cases/process-payment.use-case';
import { StartPaymentUseCase } from '../../../application/use-cases/start-payment.use-case';
import {
  ConfirmPaymentBodyDto,
  InitiateCheckoutBodyDto,
  PaymentWebhookBodyDto,
  SchoolScopedQueryDto,
  StartPaymentBodyDto,
} from '../dto/billing.http-dto';

type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly initiateCheckout: InitiatePaymentCheckoutUseCase,
    private readonly startPayment: StartPaymentUseCase,
    private readonly listPayments: ListSchoolPaymentsUseCase,
    private readonly getPayment: GetPaymentUseCase,
    private readonly confirmPayment: ConfirmPaymentUseCase,
    private readonly processPayment: ProcessPaymentUseCase,
    private readonly processFindoraWebhook: ProcessFindoraWebhookUseCase,
  ) {}

  @Post('payments/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Iniciar checkout de pagamento (Multicaixa Express ou referência bancária)',
    description:
      'Rota única para o frontend. O backend cria invoice, sessão e intent no gateway.',
  })
  async checkout(
    @Body() body: InitiateCheckoutBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.initiateCheckout.execute({
        actorUserId: user.id,
        schoolId: body.schoolId,
        planId: body.planId,
        method: body.method ?? 'MULTICAIXA_EXPRESS',
        expressPhone: body.expressPhone,
        subscriptionId: body.subscriptionId,
        action: body.action,
      }),
      'Checkout initiated',
    );
  }

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
    summary: 'Iniciar pagamento (legado — preferir POST /payments/checkout)',
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
        method: body.method ?? 'MULTICAIXA_EXPRESS',
        expressPhone: body.expressPhone,
      }),
      'Payment initiated',
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

  @Post('webhooks/payments/findora')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Findora (HMAC x-findora-signature)' })
  async findoraWebhook(
    @Req() req: RawBodyRequest,
    @Headers('x-findora-signature') signature: string | undefined,
  ) {
    const rawBody =
      req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {});
    return ok(
      await this.processFindoraWebhook.execute({ rawBody, signature }),
      'Webhook processed',
    );
  }

  @Post('webhooks/payments')
  @ApiOperation({
    summary: 'Webhook genérico de pagamentos (dev/simulado)',
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
