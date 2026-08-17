import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../../../../shared/application/api-response';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { SchoolLegalService } from '../../../application/school-legal.service';
import { SubmitNifBodyDto } from '../dto/school-legal.http-dto';

@ApiTags('schools')
@Controller('schools/:schoolId/legal')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SchoolLegalController {
  constructor(private readonly legal: SchoolLegalService) {}

  @Get()
  @ApiOperation({ summary: 'Overview jurídico do colégio (NIF e secções)' })
  async getOverview(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(await this.legal.getOverview(schoolId, user.id), 'Legal overview fetched');
  }

  @Post('nif')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submeter NIF com consentimento' })
  async submitNif(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: SubmitNifBodyDto,
  ) {
    return ok(
      await this.legal.submitNif(schoolId, user.id, body),
      'NIF submitted for validation',
    );
  }

  @Post('sections/:sectionId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar secção jurídica como lida' })
  async markSectionRead(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return ok(
      await this.legal.markSectionRead(schoolId, user.id, sectionId),
      'Legal section marked as read',
    );
  }
}
