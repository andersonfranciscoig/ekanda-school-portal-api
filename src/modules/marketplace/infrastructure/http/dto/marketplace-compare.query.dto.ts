import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class MarketplaceCompareQueryDto {
  @ApiProperty({
    description: 'IDs dos colégios a comparar, separados por vírgula (2 ou 3)',
    example:
      '845c8984-0d71-4bee-9eb4-6347a41de776,11111111-1111-4111-8111-111111111111',
  })
  @IsString()
  @MinLength(36)
  ids!: string;
}
