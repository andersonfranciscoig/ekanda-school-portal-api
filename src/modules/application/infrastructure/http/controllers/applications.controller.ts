import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ok } from '../../../../../shared/application/api-response';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { CreateApplicationUseCase } from '../../../application/use-cases/create-application.use-case';
import { ListApplicationsUseCase } from '../../../application/use-cases/list-applications.use-case';

class ListMyApplicationsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

class CreateApplicationBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  schoolClassId?: string;

  @ApiPropertyOptional({ enum: ['MORNING', 'AFTERNOON', 'NIGHT', 'DOUBLE'] })
  @IsOptional()
  @IsIn(['MORNING', 'AFTERNOON', 'NIGHT', 'DOUBLE'])
  requestedShift?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly createApplication: CreateApplicationUseCase,
    private readonly listApplications: ListApplicationsUseCase,
  ) {}

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Candidaturas do encarregado autenticado' })
  async listMine(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMyApplicationsQueryDto,
  ) {
    return ok(
      await this.listApplications.execute({
        guardianId: user.id,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 50,
      }),
      'Applications listed',
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Criar candidatura (bloqueada se a escola não tiver APPLICATIONS_RECEIVE)',
  })
  async create(
    @Body() body: CreateApplicationBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.createApplication.execute({
      actorUserId: user.id,
      schoolId: body.schoolId,
      studentId: body.studentId,
      schoolClassId: body.schoolClassId,
      requestedShift: body.requestedShift,
      notes: body.notes,
    });
    return ok(result, 'Application submitted');
  }
}
