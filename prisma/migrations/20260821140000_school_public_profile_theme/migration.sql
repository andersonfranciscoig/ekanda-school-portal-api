-- Personalização do perfil público: paleta + ordem de secções.
CREATE TYPE "SchoolPublicProfilePalette" AS ENUM (
  'EKANDA',
  'LAGOA',
  'OCEANO',
  'SOL',
  'FLORESTA',
  'AREIA'
);

ALTER TABLE "schools"
ADD COLUMN "publicProfilePalette" "SchoolPublicProfilePalette" NOT NULL DEFAULT 'EKANDA';

ALTER TABLE "schools"
ADD COLUMN "publicProfileSectionOrder" JSONB;
