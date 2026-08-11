import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SchoolAccessAuthorizer } from '../../../school/application/services/school-access.authorizer';
import { WalletLedgerService } from '../services/wallet-ledger.service';

export type GetSchoolWalletInput = {
  actorUserId: string;
  schoolId: string;
};

@Injectable()
export class GetSchoolWalletUseCase
  implements UseCase<GetSchoolWalletInput, unknown>
{
  constructor(
    private readonly access: SchoolAccessAuthorizer,
    private readonly ledger: WalletLedgerService,
  ) {}

  async execute(input: GetSchoolWalletInput) {
    await this.access.assertCanManageSchool(input.actorUserId, input.schoolId);
    const wallet = await this.ledger.ensureSchoolWallet(input.schoolId);
    return this.ledger.presentWallet(wallet);
  }
}
