import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {}
