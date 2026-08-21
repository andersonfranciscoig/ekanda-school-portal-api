-- Toggle admin: validação automática de NIF (AGT). Default desactivado.
ALTER TABLE "platform_settings"
ADD COLUMN "autoNifVerificationEnabled" BOOLEAN NOT NULL DEFAULT false;
