import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateOrUpdateSchoolUseCase } from '../../../application/use-cases/create-or-update-school.use-case';
import { CreateOrUpdateSchoolLocationUseCase } from '../../../application/use-cases/create-or-update-school-location.use-case';
import { SyncSchoolEducationLevelsUseCase } from '../../../application/use-cases/sync-school-education-levels.use-case';
import { CreateOrUpdateSchoolClassUseCase } from '../../../application/use-cases/create-or-update-school-class.use-case';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { ok } from '../../../../../shared/application/api-response';
import { CreateOrUpdateSchoolHttpDto } from '../dto/create-or-update-school.http-dto';
import { CreateOrUpdateSchoolLocationHttpDto } from '../dto/create-or-update-school-location.http-dto';
import { SyncSchoolEducationLevelsHttpDto } from '../dto/sync-school-education-levels.http-dto';
import { CreateOrUpdateSchoolClassHttpDto } from '../dto/create-or-update-school-class.http-dto';
import { SchoolHttpQueryService } from '../school-http-query.service';
import { UploadFileInput } from '../../../../../shared/application/ports/file-storage.port';

type SchoolFiles = {
  logo?: Express.Multer.File[];
  logoUrl?: Express.Multer.File[];
  coverImage?: Express.Multer.File[];
  coverImageUrl?: Express.Multer.File[];
};

function toUploadInput(file?: Express.Multer.File): UploadFileInput | undefined {
  if (!file) return undefined;
  return {
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

function firstFile(
  files: SchoolFiles | undefined,
  ...keys: (keyof SchoolFiles)[]
): Express.Multer.File | undefined {
  for (const key of keys) {
    const match = files?.[key]?.[0];
    if (match) return match;
  }
  return undefined;
}

@ApiTags('schools')
@Controller('schools')
export class SchoolsController {
  constructor(
    private readonly createOrUpdateSchool: CreateOrUpdateSchoolUseCase,
    private readonly createOrUpdateSchoolLocation: CreateOrUpdateSchoolLocationUseCase,
    private readonly syncSchoolEducationLevels: SyncSchoolEducationLevelsUseCase,
    private readonly createOrUpdateSchoolClass: CreateOrUpdateSchoolClassUseCase,
    private readonly queries: SchoolHttpQueryService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: CreateOrUpdateSchoolHttpDto })
  @ApiOperation({
    summary:
      'CreateOrUpdate school (POST). No id = create (DRAFT); with id = update. multipart for logo/cover.',
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        // Prefer `logo` / `coverImage`; also accept `logoUrl` / `coverImageUrl`
        // when clients send binary parts with DTO property names.
        { name: 'logo', maxCount: 1 },
        { name: 'logoUrl', maxCount: 1 },
        { name: 'coverImage', maxCount: 1 },
        { name: 'coverImageUrl', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024, files: 2 },
      },
    ),
  )
  async createOrUpdate(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrUpdateSchoolHttpDto,
    @UploadedFiles() files: SchoolFiles | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const logoFile = firstFile(files, 'logo', 'logoUrl');
    const coverImageFile = firstFile(files, 'coverImage', 'coverImageUrl');

    const { school, operation } = await this.createOrUpdateSchool.execute({
      actorUserId: user.id,
      actorRole: user.role,
      id: dto.id,
      name: dto.name,
      description: dto.description,
      phone: dto.phone,
      email: dto.email,
      website: dto.website,
      logoUrl: logoFile ? undefined : dto.logoUrl,
      coverImageUrl: coverImageFile ? undefined : dto.coverImageUrl,
      foundedYear: dto.foundedYear,
      foundedAt: dto.foundedAt,
      approximateStudents: dto.approximateStudents,
      instagram: dto.instagram,
      facebook: dto.facebook,
      province: dto.province,
      municipality: dto.municipality,
      neighborhood: dto.neighborhood,
      address: dto.address,
      logoFile: toUploadInput(logoFile),
      coverImageFile: toUploadInput(coverImageFile),
    });

    const detail =
      operation === 'created'
        ? await this.queries.findCreatedDetail(school.id, user.id)
        : await this.queries.findOneForMember(school.id, user.id);

    res.status(
      operation === 'created' ? HttpStatus.CREATED : HttpStatus.OK,
    );

    return ok(
      detail,
      operation === 'created'
        ? 'School created successfully'
        : 'School updated successfully',
    );
  }

  @Post('location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiConsumes('application/json')
  @ApiBody({ type: CreateOrUpdateSchoolLocationHttpDto })
  @ApiOperation({
    summary:
      'CreateOrUpdate school location (POST JSON). No id = create; with id = update. 1:1 with School.',
  })
  async createOrUpdateLocation(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrUpdateSchoolLocationHttpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { location, operation } =
      await this.createOrUpdateSchoolLocation.execute({
        actorUserId: user.id,
        id: dto.id,
        schoolId: dto.schoolId,
        province: dto.province,
        municipality: dto.municipality,
        neighborhood: dto.neighborhood,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });

    res.status(
      operation === 'created' ? HttpStatus.CREATED : HttpStatus.OK,
    );

    return ok(
      location.toSnapshot(),
      'School location saved successfully',
    );
  }

  @Post('education-levels')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiConsumes('application/json')
  @ApiBody({ type: SyncSchoolEducationLevelsHttpDto })
  @ApiOperation({
    summary:
      'Sync school education levels (POST JSON). Request levels = final state.',
  })
  async syncEducationLevels(
    @CurrentUser() user: AuthUser,
    @Body() dto: SyncSchoolEducationLevelsHttpDto,
  ) {
    const result = await this.syncSchoolEducationLevels.execute({
      actorUserId: user.id,
      schoolId: dto.schoolId,
      levels: dto.levels,
    });

    return ok(result, 'Education levels synchronized successfully');
  }

  @Post('classes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiConsumes('application/json')
  @ApiBody({ type: CreateOrUpdateSchoolClassHttpDto })
  @ApiOperation({
    summary:
      'CreateOrUpdate school class (POST JSON). No id = create; with id = update.',
  })
  async createOrUpdateClass(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrUpdateSchoolClassHttpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { schoolClass, operation } =
      await this.createOrUpdateSchoolClass.execute({
        actorUserId: user.id,
        id: dto.id,
        schoolId: dto.schoolId,
        classLabel: dto.classLabel,
        vacancies: dto.vacancies,
        shift: dto.shift,
        schedule: dto.schedule,
      });

    res.status(
      operation === 'created' ? HttpStatus.CREATED : HttpStatus.OK,
    );

    return ok(
      schoolClass.toSnapshot(),
      operation === 'created'
        ? 'School class created successfully'
        : 'School class updated successfully',
    );
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List schools of the authenticated user' })
  findMine(@CurrentUser() user: AuthUser) {
    return this.queries.findMine(user.id);
  }

  @Get('public/:slug')
  @ApiOperation({ summary: 'Public school profile by slug (ACTIVE only)' })
  findPublicBySlug(@Param('slug') slug: string) {
    return this.queries.findPublicBySlug(slug);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'School detail (active members only)' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queries.findOneForMember(id, user.id);
  }
}
