import { Module } from '@nestjs/common';
import { OllamaConciergeClient } from '../concierge/infrastructure/ollama/ollama-concierge.client';

/**
 * Cliente Ollama partilhado (concierge + marketplace compare).
 * Evita dependência circular Concierge ↔ Marketplace.
 */
@Module({
  providers: [OllamaConciergeClient],
  exports: [OllamaConciergeClient],
})
export class AiModule {}
