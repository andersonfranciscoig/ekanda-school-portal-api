import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SCHOOL_REPOSITORY } from './domain/repositories/school.repository';
import { SCHOOL_LOCATION_REPOSITORY } from './domain/repositories/school-location.repository';
import { SCHOOL_EDUCATION_LEVEL_REPOSITORY } from './domain/repositories/school-education-level.repository';
import { SCHOOL_CLASS_REPOSITORY } from './domain/repositories/school-class.repository';
import { CreateOrUpdateSchoolUseCase } from './application/use-cases/create-or-update-school.use-case';
import { CreateOrUpdateSchoolLocationUseCase } from './application/use-cases/create-or-update-school-location.use-case';
import { SyncSchoolEducationLevelsUseCase } from './application/use-cases/sync-school-education-levels.use-case';
import { CreateOrUpdateSchoolClassUseCase } from './application/use-cases/create-or-update-school-class.use-case';
import { CreateOrUpdateSchoolServiceUseCase } from './application/use-cases/create-or-update-school-service.use-case';
import { CreateOrUpdateSchoolPriceUseCase } from './application/use-cases/create-or-update-school-price.use-case';
import { CreateOrUpdateSchoolGalleryUseCase } from './application/use-cases/create-or-update-school-gallery.use-case';
import { SubmitSchoolForActivationUseCase } from './application/use-cases/submit-school-for-activation.use-case';
import { CheckSchoolActivationEligibilityUseCase } from './application/use-cases/check-school-activation-eligibility.use-case';
import { PublishSchoolUseCase } from './application/use-cases/publish-school.use-case';
import { SuspendSchoolUseCase } from './application/use-cases/suspend-school.use-case';
import { ReactivateSchoolUseCase } from './application/use-cases/reactivate-school.use-case';
import { ExpireSchoolUseCase } from './application/use-cases/expire-school.use-case';
import { SchoolAccessAuthorizer } from './application/services/school-access.authorizer';
import { PrismaSchoolRepository } from './infrastructure/persistence/prisma/prisma-school.repository';
import { PrismaSchoolLocationRepository } from './infrastructure/persistence/prisma/prisma-school-location.repository';
import { PrismaSchoolEducationLevelRepository } from './infrastructure/persistence/prisma/prisma-school-education-level.repository';
import { PrismaSchoolClassRepository } from './infrastructure/persistence/prisma/prisma-school-class.repository';
import { SchoolsController } from './infrastructure/http/controllers/schools.controller';
import { SchoolHttpQueryService } from './infrastructure/http/school-http-query.service';

const schoolUseCases = [
  CreateOrUpdateSchoolUseCase,
  CreateOrUpdateSchoolLocationUseCase,
  SyncSchoolEducationLevelsUseCase,
  CreateOrUpdateSchoolClassUseCase,
  CreateOrUpdateSchoolServiceUseCase,
  CreateOrUpdateSchoolPriceUseCase,
  CreateOrUpdateSchoolGalleryUseCase,
  SubmitSchoolForActivationUseCase,
  CheckSchoolActivationEligibilityUseCase,
  PublishSchoolUseCase,
  SuspendSchoolUseCase,
  ReactivateSchoolUseCase,
  ExpireSchoolUseCase,
];

@Module({
  imports: [IdentityModule],
  controllers: [SchoolsController],
  providers: [
    { provide: SCHOOL_REPOSITORY, useClass: PrismaSchoolRepository },
    {
      provide: SCHOOL_LOCATION_REPOSITORY,
      useClass: PrismaSchoolLocationRepository,
    },
    {
      provide: SCHOOL_EDUCATION_LEVEL_REPOSITORY,
      useClass: PrismaSchoolEducationLevelRepository,
    },
    {
      provide: SCHOOL_CLASS_REPOSITORY,
      useClass: PrismaSchoolClassRepository,
    },
    SchoolAccessAuthorizer,
    SchoolHttpQueryService,
    ...schoolUseCases,
  ],
  exports: [
    SCHOOL_REPOSITORY,
    SCHOOL_LOCATION_REPOSITORY,
    SCHOOL_EDUCATION_LEVEL_REPOSITORY,
    SCHOOL_CLASS_REPOSITORY,
    SchoolAccessAuthorizer,
    ...schoolUseCases,
  ],
})
export class SchoolModule {}
