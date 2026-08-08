# Ekanda School Portal API

Backend MVP v1.0 — ecossistema educacional Ekanda (Angola).

## Stack

- NestJS + TypeScript
- Prisma ORM + PostgreSQL
- DDD / Clean Architecture / Hexagonal
- Docker / Docker Compose
- JWT + Swagger (`/docs`)

Arquitectura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Arranque

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

- Health: `http://localhost:$PORT/api/v1/health`
- Swagger: `http://localhost:$PORT/docs`

## Bounded Contexts

`identity` · `school` · `marketplace` · `application` · `billing` · `notification` · `administration`
