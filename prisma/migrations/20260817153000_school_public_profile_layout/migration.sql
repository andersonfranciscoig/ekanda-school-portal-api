-- Layout do perfil público do colégio (clássico = predefinição)

CREATE TYPE "SchoolPublicProfileLayout" AS ENUM ('CLASSIC', 'EDITORIAL', 'CAMPUS');

ALTER TABLE "schools"
ADD COLUMN "publicProfileLayout" "SchoolPublicProfileLayout" NOT NULL DEFAULT 'CLASSIC';
