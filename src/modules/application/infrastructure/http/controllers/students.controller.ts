import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ok } from '../../../../../shared/application/api-response';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { CreateOrUpdateStudentUseCase } from '../../../application/use-cases/create-or-update-student.use-case';
import { ListMyStudentsUseCase } from '../../../application/use-cases/list-my-students.use-case';

class UpsertStudentBodyDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({ example: '2014-03-02' })
  @IsDateString()
  birthDate!: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsIn(Object.values(Gender))
  gender?: Gender;
}

@ApiTags('students')
@Controller('students')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class StudentsController {
  constructor(
    private readonly listMine: ListMyStudentsUseCase,
    private readonly upsertStudent: CreateOrUpdateStudentUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar filhos do encarregado autenticado' })
  async list(@CurrentUser() user: AuthUser) {
    return ok(
      await this.listMine.execute({ actorUserId: user.id }),
      'Students listed',
    );
  }

  @Post()
  @ApiOperation({ summary: 'Criar ou actualizar um filho (id ausente = criar)' })
  async upsert(@Body() body: UpsertStudentBodyDto, @CurrentUser() user: AuthUser) {
    return ok(
      await this.upsertStudent.execute({
        actorUserId: user.id,
        id: body.id,
        firstName: body.firstName,
        lastName: body.lastName,
        birthDate: body.birthDate,
        gender: body.gender,
      }),
      body.id ? 'Student updated' : 'Student created',
    );
  }
}
