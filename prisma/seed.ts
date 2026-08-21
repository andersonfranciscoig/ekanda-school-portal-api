import { PrismaClient, PlanCode, BillingPeriod } from '@prisma/client';

const prisma = new PrismaClient();

const FREE_FEATURES = [
  {
    code: 'PUBLIC_PROFILE',
    name: 'Perfil público',
    description:
      'Permite que o colégio mantenha o seu perfil público visível no marketplace durante o período gratuito.',
  },
] as const;

const PRESENCE_FEATURES = [
  {
    code: 'PUBLIC_PROFILE',
    name: 'Perfil público',
    description: 'Perfil público do colégio visível na plataforma',
  },
  {
    code: 'MARKETPLACE_LISTING',
    name: 'Listagem no marketplace',
    description: 'Aparecer nas pesquisas e no marketplace Ekanda',
  },
  {
    code: 'CONCIERGE_RECOMMENDATION',
    name: 'Recomendação concierge',
    description: 'Incluído no motor de recomendação/concierge',
  },
  {
    code: 'VIEW_APPLICATIONS',
    name: 'Ver candidaturas',
    description: 'Consultar candidaturas recebidas',
  },
  {
    code: 'APPLICATIONS_RECEIVE',
    name: 'Receber candidaturas',
    description: 'Permitir que encarregados submetam novas candidaturas',
  },
  {
    code: 'MANAGE_APPLICATIONS',
    name: 'Gerir candidaturas',
    description: 'Aceitar, rejeitar e solicitar documentos',
  },
  {
    code: 'EDIT_SCHOOL_PROFILE',
    name: 'Editar perfil do colégio',
    description: 'Atualizar dados, galeria, classes e serviços',
  },
  {
    code: 'BASIC_ANALYTICS',
    name: 'Analytics básico',
    description: 'Métricas básicas do dashboard do colégio',
  },
] as const;

const MANAGEMENT_FEATURES = [
  {
    code: 'MANAGE_STUDENTS',
    name: 'Gerir alunos',
    description: 'Gestão escolar de alunos (fase futura)',
  },
  {
    code: 'MANAGE_TEACHERS',
    name: 'Gerir professores',
    description: 'Gestão de professores (fase futura)',
  },
  {
    code: 'MANAGE_CLASSES',
    name: 'Gerir turmas',
    description: 'Gestão académica de turmas (fase futura)',
  },
  {
    code: 'MANAGE_ATTENDANCE',
    name: 'Gerir assiduidade',
    description: 'Controlo de presença (fase futura)',
  },
  {
    code: 'MANAGE_GRADES',
    name: 'Gerir notas',
    description: 'Lançamento de notas (fase futura)',
  },
  {
    code: 'MANAGE_FEES',
    name: 'Gerir propinas',
    description: 'Cobrança e propinas escolares (fase futura)',
  },
  {
    code: 'MANAGE_SCHEDULES',
    name: 'Gerir horários',
    description: 'Horários lectivos (fase futura)',
  },
  {
    code: 'WHATSAPP_COMMUNICATION',
    name: 'Comunicação WhatsApp',
    description: 'Comunicação via WhatsApp (fase futura)',
  },
] as const;

async function upsertPlan(params: {
  code: PlanCode;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingPeriod: BillingPeriod;
  isActive: boolean;
  isPublic: boolean;
  features: ReadonlyArray<{ code: string; name: string; description: string }>;
}) {
  const plan = await prisma.plan.upsert({
    where: { code: params.code },
    update: {
      name: params.name,
      description: params.description,
      price: params.price,
      currency: params.currency,
      billingPeriod: params.billingPeriod,
      isActive: params.isActive,
      isPublic: params.isPublic,
    },
    create: {
      code: params.code,
      name: params.name,
      description: params.description,
      price: params.price,
      currency: params.currency,
      billingPeriod: params.billingPeriod,
      isActive: params.isActive,
      isPublic: params.isPublic,
    },
  });

  for (const feature of params.features) {
    await prisma.planFeature.upsert({
      where: {
        planId_code: {
          planId: plan.id,
          code: feature.code,
        },
      },
      update: {
        name: feature.name,
        description: feature.description,
      },
      create: {
        planId: plan.id,
        code: feature.code,
        name: feature.name,
        description: feature.description,
      },
    });
  }

  return plan;
}

async function main() {
  await upsertPlan({
    code: PlanCode.FREE,
    name: 'Gratuito',
    description:
      'Plano gratuito de 30 dias para visibilidade pública do colégio no marketplace. Sem pagamento e sem funcionalidades de gestão escolar.',
    price: 0,
    currency: 'AOA',
    billingPeriod: BillingPeriod.ONE_TIME,
    isActive: true,
    isPublic: true,
    features: FREE_FEATURES,
  });

  await upsertPlan({
    code: PlanCode.PRESENCE,
    name: 'Presença',
    description:
      'Plano MVP para perfil público, marketplace, candidaturas e gestão básica do colégio na Ekanda.',
    price: 15000,
    currency: 'AOA',
    billingPeriod: BillingPeriod.MONTHLY,
    isActive: true,
    isPublic: true,
    features: PRESENCE_FEATURES,
  });

  await upsertPlan({
    code: PlanCode.MANAGEMENT,
    name: 'Gestão',
    description:
      'Plano de subscrição para gestão escolar completa: alunos, turmas, notas, propinas e comunicação. Lançamento gradual com fila de testes.',
    price: 50000,
    currency: 'AOA',
    billingPeriod: BillingPeriod.MONTHLY,
    isActive: false,
    isPublic: false,
    features: MANAGEMENT_FEATURES,
  });

  await prisma.platformSetting.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      betaEnabled: false,
      whatsappCommunityUrl: null,
      betaLimitGuardian: 50,
      betaLimitSchoolOwner: 20,
      autoNifVerificationEnabled: false,
    },
    update: {},
  });

  console.log(
    'Seed concluído: planos FREE (activo), PRESENCE (activo) e MANAGEMENT (inactivo); platform_settings.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
