import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../../../../shared/application/api-response';
import { GetPlanUseCase } from '../../../application/use-cases/get-plan.use-case';
import { ListPlansUseCase } from '../../../application/use-cases/list-plans.use-case';

@ApiTags('billing')
@Controller('plans')
export class BillingController {
  constructor(
    private readonly listPlans: ListPlansUseCase,
    private readonly getPlan: GetPlanUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar planos públicos activos' })
  async list() {
    return ok(await this.listPlans.execute(), 'Plans listed');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter plano por id' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return ok(await this.getPlan.execute({ planId: id }), 'Plan fetched');
  }
}
