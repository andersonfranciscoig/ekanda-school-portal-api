import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {}
