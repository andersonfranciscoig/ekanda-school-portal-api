import {
  Body,
  Controller,
  Delete,
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
import { SyncSchoolServicesUseCase } from '../../../application/use-cases/sync-school-services.use-case';
import { CreateOrUpdateSchoolPriceUseCase } from '../../../application/use-cases/create-or-update-school-price.use-case';
import { GetSchoolPriceUseCase } from '../../../application/use-cases/get-school-price.use-case';
import { CreateOrUpdateSchoolGalleryUseCase } from '../../../application/use-cases/create-or-update-school-gallery.use-case';
import { GetSchoolOnboardingReviewUseCase } from '../../../application/use-cases/get-school-onboarding-review.use-case';
import { CompleteSchoolOnboardingUseCase } from '../../../application/use-cases/complete-school-onboarding.use-case';
import { GetSchoolDashboardUseCase } from '../../../application/use-cases/get-school-dashboard.use-case';
import { DeleteSchoolLogoUseCase } from '../../../application/use-cases/delete-school-logo.use-case';
import { DeleteSchoolLocationUseCase } from '../../../application/use-cases/delete-school-location.use-case';
import { DeleteSchoolClassUseCase } from '../../../application/use-cases/delete-school-class.use-case';
import { DeleteSchoolGalleryItemUseCase } from '../../../application/use-cases/delete-school-gallery-item.use-case';
import { DeleteSchoolPriceUseCase } from '../../../application/use-cases/delete-school-price.use-case';
import { DeleteSchoolEducationLevelsUseCase } from '../../../application/use-cases/delete-school-education-levels.use-case';
import { DeleteSchoolServicesUseCase } from '../../../application/use-cases/delete-school-services.use-case';
import { JwtAuthGuard } from '../../../../identity/infrastructure/auth/jwt-auth.guard';
import { CurrentUser } from '../../../../../shared/infrastructure/http/current-user.decorator';
import { AuthUser } from '../../../../identity/infrastructure/auth/auth-user.type';
import { ok } from '../../../../../shared/application/api-response';
import { CreateOrUpdateSchoolHttpDto } from '../dto/create-or-update-school.http-dto';
import { CreateOrUpdateSchoolLocationHttpDto } from '../dto/create-or-update-school-location.http-dto';
import { SyncSchoolEducationLevelsHttpDto } from '../dto/sync-school-education-levels.http-dto';
import { CreateOrUpdateSchoolClassHttpDto } from '../dto/create-or-update-school-class.http-dto';
import { SyncSchoolServicesHttpDto } from '../dto/sync-school-services.http-dto';
import { CreateOrUpdateSchoolPriceHttpDto } from '../dto/create-or-update-school-price.http-dto';
import { CreateOrUpdateSchoolGalleryHttpDto } from '../dto/create-or-update-school-gallery.http-dto';
import { SchoolHttpQueryService } from '../school-http-query.service';
import { UploadFileInput } from '../../../../../shared/application/ports/file-storage.port';

type SchoolFiles = {
  logo?: Express.Multer.File[];
  logoUrl?: Express.Multer.File[];
  coverImage?: Express.Multer.File[];
  coverImageUrl?: Express.Multer.File[];
};

type GalleryFiles = {
  photos?: Express.Multer.File[];
  videos?: Express.Multer.File[];
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

function toUploadInputs(files?: Express.Multer.File[]): UploadFileInput[] {
  return (files ?? [])
    .map((file) => toUploadInput(file))
    .filter((file): file is UploadFileInput => Boolean(file));
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
    private readonly syncSchoolServices: SyncSchoolServicesUseCase,
    private readonly createOrUpdateSchoolPrice: CreateOrUpdateSchoolPriceUseCase,
    private readonly getSchoolPrice: GetSchoolPriceUseCase,
    private readonly createOrUpdateSchoolGallery: CreateOrUpdateSchoolGalleryUseCase,
    private readonly getSchoolOnboardingReview: GetSchoolOnboardingReviewUseCase,
    private readonly completeSchoolOnboarding: CompleteSchoolOnboardingUseCase,
    private readonly getSchoolDashboard: GetSchoolDashboardUseCase,
    private readonly deleteSchoolLogo: DeleteSchoolLogoUseCase,
    private readonly deleteSchoolLocation: DeleteSchoolLocationUseCase,
    private readonly deleteSchoolClass: DeleteSchoolClassUseCase,
    private readonly deleteSchoolGalleryItem: DeleteSchoolGalleryItemUseCase,
    private readonly deleteSchoolPrice: DeleteSchoolPriceUseCase,
    private readonly deleteSchoolEducationLevels: DeleteSchoolEducationLevelsUseCase,
    private readonly deleteSchoolServices: DeleteSchoolServicesUseCase,
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
      institutionType: dto.institutionType,
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

  @Post('services')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiConsumes('application/json')
  @ApiBody({ type: SyncSchoolServicesHttpDto })
  @ApiOperation({
    summary:
      'Sync school services (POST JSON). Request serviceIds = final state.',
  })
  async syncServices(
    @CurrentUser() user: AuthUser,
    @Body() dto: SyncSchoolServicesHttpDto,
  ) {
    const result = await this.syncSchoolServices.execute({
      actorUserId: user.id,
      schoolId: dto.schoolId,
      serviceIds: dto.serviceIds,
    });

    return ok(result, 'School services synchronized successfully');
  }

  @Post('prices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiConsumes('application/json')
  @ApiBody({ type: CreateOrUpdateSchoolPriceHttpDto })
  @ApiOperation({
    summary:
      'CreateOrUpdate school prices (POST JSON). No id = create; with id = update. Levels must be offered by the school.',
  })
  async createOrUpdatePrices(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrUpdateSchoolPriceHttpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { pricing, operation } = await this.createOrUpdateSchoolPrice.execute({
      actorUserId: user.id,
      id: dto.id,
      schoolId: dto.schoolId,
      levels: dto.levels,
      otherFees: dto.otherFees,
      currency: dto.currency,
      feesAreFree: dto.feesAreFree,
    });

    res.status(
      operation === 'created' ? HttpStatus.CREATED : HttpStatus.OK,
    );

    return ok(
      pricing.toSnapshot(),
      operation === 'created'
        ? 'School prices created successfully'
        : 'School prices updated successfully',
    );
  }

  @Post('gallery')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateOrUpdateSchoolGalleryHttpDto })
  @ApiOperation({
    summary:
      'CreateOrUpdate school gallery (multipart). photos[] JPEG/PNG ≤10MB; videos[] MP4 ≤200MB. No id = create; with id = replace set.',
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photos', maxCount: 30 },
        { name: 'videos', maxCount: 10 },
      ],
      {
        storage: memoryStorage(),
        limits: {
          fileSize: 200 * 1024 * 1024,
          files: 40,
        },
      },
    ),
  )
  async createOrUpdateGallery(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrUpdateSchoolGalleryHttpDto,
    @UploadedFiles() files: GalleryFiles | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { items, operation } =
      await this.createOrUpdateSchoolGallery.execute({
        actorUserId: user.id,
        id: dto.id,
        schoolId: dto.schoolId,
        photos: toUploadInputs(files?.photos),
        videos: toUploadInputs(files?.videos),
      });

    res.status(
      operation === 'created' ? HttpStatus.CREATED : HttpStatus.OK,
    );

    return ok(
      items.map((item) => item.toSnapshot()),
      operation === 'created'
        ? 'School gallery created successfully'
        : 'School gallery updated successfully',
    );
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List schools of the authenticated user' })
  findMine(@CurrentUser() user: AuthUser) {
    return this.queries.findMine(user.id);
  }

  @Delete(':schoolId/logo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove school logo (OWNER/ADMIN)' })
  async removeLogo(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.deleteSchoolLogo.execute({
      schoolId,
      actorUserId: user.id,
    });
    return ok(result, 'School logo deleted successfully');
  }

  @Delete(':schoolId/location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove school location (OWNER/ADMIN)' })
  async removeLocation(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.deleteSchoolLocation.execute({
      schoolId,
      actorUserId: user.id,
    });
    return ok(result, 'School location deleted successfully');
  }

  @Delete(':schoolId/classes/:classId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Deactivate school class — soft delete (OWNER/ADMIN)',
  })
  async removeClass(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.deleteSchoolClass.execute({
      schoolId,
      classId,
      actorUserId: user.id,
    });
    return ok(result, 'School class deleted successfully');
  }

  @Delete(':schoolId/gallery/:mediaId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove gallery media item (OWNER/ADMIN)' })
  async removeGalleryItem(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.deleteSchoolGalleryItem.execute({
      schoolId,
      mediaId,
      actorUserId: user.id,
    });
    return ok(result, 'School gallery item deleted successfully');
  }

  @Delete(':schoolId/prices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove school prices (OWNER/ADMIN)' })
  async removePrices(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.deleteSchoolPrice.execute({
      schoolId,
      actorUserId: user.id,
    });
    return ok(result, 'School prices deleted successfully');
  }

  @Get(':schoolId/prices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get school prices by schoolId (OWNER/ADMIN)' })
  async getPrices(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const pricing = await this.getSchoolPrice.execute({
      schoolId,
      actorUserId: user.id,
    });
    return ok(pricing.toSnapshot(), 'School prices');
  }

  @Delete(':schoolId/education-levels')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove all school education levels (OWNER/ADMIN)' })
  async removeEducationLevels(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.deleteSchoolEducationLevels.execute({
      schoolId,
      actorUserId: user.id,
    });
    return ok(result, 'School education levels deleted successfully');
  }

  @Delete(':schoolId/services')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove all school services (OWNER/ADMIN)' })
  async removeServices(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.deleteSchoolServices.execute({
      schoolId,
      actorUserId: user.id,
    });
    return ok(result, 'School services deleted successfully');
  }

  @Get('public/:slug')
  @ApiOperation({ summary: 'Public school profile by slug (ACTIVE only)' })
  findPublicBySlug(@Param('slug') slug: string) {
    return this.queries.findPublicBySlug(slug);
  }

  @Get(':schoolId/onboarding')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'School onboarding review — checklist, missing fields, completion %, canSubmit',
  })
  async getOnboarding(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const review = await this.getSchoolOnboardingReview.execute({
      schoolId,
      userId: user.id,
    });
    return ok(review, 'School onboarding review');
  }

  @Post(':schoolId/onboarding/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Concluir cadastro: plano FREE + submissão para PENDING_REVIEW',
  })
  async completeOnboarding(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.completeSchoolOnboarding.execute({
      schoolId,
      userId: user.id,
    });
    return ok(result, 'School onboarding completed successfully');
  }

  @Get(':schoolId/dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Dashboard do colégio — métricas e gráficos' })
  async dashboard(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.getSchoolDashboard.execute({
      schoolId,
      actorUserId: user.id,
    });
    return ok(data, 'School dashboard');
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
