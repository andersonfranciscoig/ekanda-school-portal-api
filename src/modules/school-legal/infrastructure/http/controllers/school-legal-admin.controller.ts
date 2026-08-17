import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../../../../shared/application/api-response';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { UserRole } from '../../../../identity/domain/entities/user.entity';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { Roles } from '../../../../identity/infrastructure/auth/roles.decorator';
import { RolesGuard } from '../../../../identity/infrastructure/auth/roles.guard';
import { SchoolLegalService } from '../../../application/school-legal.service';
import {
  AdminLegalSchoolsQueryDto,
  LegalAuditQueryDto,
  RejectNifBodyDto,
  VerifyNifManualBodyDto,
} from '../dto/school-legal.http-dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EKANDA_ADMIN)
@ApiBearerAuth('access-token')
export class SchoolLegalAdminController {
  constructor(private readonly legal: SchoolLegalService) {}

  @Get('legal/summary')
  @ApiOperation({ summary: 'Resumo de estados jurídicos (NIF)' })
  async getSummary() {
    return ok(await this.legal.getLegalSummary(), 'Legal summary fetched');
  }

  @Get('legal/schools')
  @ApiOperation({ summary: 'Lista de colégios por estado jurídico (NIF)' })
  async listSchools(@Query() query: AdminLegalSchoolsQueryDto) {
    return ok(await this.legal.listSchoolsForAdmin(query), 'Legal schools listed');
  }

  @Get('schools/:schoolId/legal')
  @ApiOperation({ summary: 'Estado jurídico do colégio (admin)' })
  async getForAdmin(@Param('schoolId', ParseUUIDPipe) schoolId: string) {
    return ok(await this.legal.getForAdmin(schoolId), 'School legal profile fetched');
  }

  @Post('schools/:schoolId/legal/nif/verify-manual')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar NIF manualmente (portal AGT) e registar admin' })
  async verifyManual(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: VerifyNifManualBodyDto,
  ) {
    void body;
    return ok(
      await this.legal.verifyNifManual(schoolId, {
        userId: user.id,
        name: user.email,
      }),
      'NIF verified manually',
    );
  }

  @Post('schools/:schoolId/legal/nif/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeitar NIF submetido com motivo' })
  async rejectNif(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: RejectNifBodyDto,
  ) {
    return ok(
      await this.legal.rejectNif(schoolId, { userId: user.id, name: user.email }, body.reason),
      'NIF rejected',
    );
  }

  @Post('schools/:schoolId/legal/notify-approved')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Notificar colégio após aprovação (in-app + email jurídico)' })
  async notifyApproved(@Param('schoolId', ParseUUIDPipe) schoolId: string) {
    return ok(await this.legal.notifySchoolApproved(schoolId), 'School legal notification sent');
  }

  @Get('legal/audit')
  @ApiOperation({ summary: 'Audit log de validações NIF' })
  async listAudit(@Query() query: LegalAuditQueryDto) {
    return ok(await this.legal.listAudit(query), 'Legal audit listed');
  }
}
