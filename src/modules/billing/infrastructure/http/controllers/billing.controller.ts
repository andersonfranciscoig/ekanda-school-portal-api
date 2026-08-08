import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('billing')
@Controller('billing')
export class BillingController {}
