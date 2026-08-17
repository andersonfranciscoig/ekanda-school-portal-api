import { Equals, IsBoolean, IsOptional, IsUUID, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { NIF_PATTERN } from '../../../application/school-legal.constants';

export class SubmitNifBodyDto {
  @Matches(NIF_PATTERN, {
    message: 'Formato de NIF inválido. Use o formato angolano (ex.: 004846965LA044).',
  })
  nif!: string;

  @Equals(true, { message: 'Deve aceitar os termos e autorizar a consulta do NIF.' })
  consentAccepted!: true;
}

export class VerifyNifManualBodyDto {
  @Equals(true, { message: 'Confirme que consultou o NIF no portal da AGT.' })
  manualConfirmation!: true;
}

export class LegalAuditQueryDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
