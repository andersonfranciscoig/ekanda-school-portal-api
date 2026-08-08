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
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { ok } from '../../../../../shared/application/api-response';
import { CreateOrUpdateSchoolHttpDto } from '../dto/create-or-update-school.http-dto';
import { SchoolHttpQueryService } from '../school-http-query.service';
import { UploadFileInput } from '../../../../../shared/application/ports/file-storage.port';

type SchoolFiles = {
  logo?: Express.Multer.File[];
  coverImage?: Express.Multer.File[];
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

@ApiTags('schools')
@Controller('schools')
export class SchoolsController {
  constructor(
    private readonly createOrUpdateSchool: CreateOrUpdateSchoolUseCase,
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
        { name: 'logo', maxCount: 1 },
        { name: 'coverImage', maxCount: 1 },
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
    const { school, operation } = await this.createOrUpdateSchool.execute({
      actorUserId: user.id,
      actorRole: user.role,
      id: dto.id,
      name: dto.name,
      description: dto.description,
      phone: dto.phone,
      email: dto.email,
      website: dto.website,
      logoUrl: dto.logoUrl,
      coverImageUrl: dto.coverImageUrl,
      foundedAt: dto.foundedAt,
      province: dto.province,
      municipality: dto.municipality,
      neighborhood: dto.neighborhood,
      address: dto.address,
      logoFile: toUploadInput(files?.logo?.[0]),
      coverImageFile: toUploadInput(files?.coverImage?.[0]),
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
