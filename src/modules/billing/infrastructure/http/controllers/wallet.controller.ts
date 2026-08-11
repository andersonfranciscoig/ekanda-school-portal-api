import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../../../../shared/application/api-response';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { GetSchoolWalletUseCase } from '../../../application/use-cases/get-school-wallet.use-case';
import { ListWalletTransactionsUseCase } from '../../../application/use-cases/list-wallet-transactions.use-case';
import {
  SchoolScopedQueryDto,
  WalletTransactionsQueryDto,
} from '../dto/billing.http-dto';

@ApiTags('billing')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class WalletController {
  constructor(
    private readonly getWallet: GetSchoolWalletUseCase,
    private readonly listTransactions: ListWalletTransactionsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Carteira financeira da instituição' })
  async get(
    @Query() query: SchoolScopedQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.getWallet.execute({
        actorUserId: user.id,
        schoolId: query.schoolId,
      }),
      'Wallet fetched',
    );
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Histórico de transações da carteira' })
  async transactions(
    @Query() query: WalletTransactionsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.listTransactions.execute({
        actorUserId: user.id,
        schoolId: query.schoolId,
        page: query.page,
        pageSize: query.pageSize,
      }),
      'Wallet transactions listed',
    );
  }
}
