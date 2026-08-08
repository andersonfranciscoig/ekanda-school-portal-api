# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

# Host platforms (e.g. Render) often set NODE_ENV=production during build,
# which makes `npm ci` skip devDependencies. Force a full install for Nest/tsc.
ENV NODE_ENV=development

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npx prisma generate \
  && npx nest build \
  && test -f dist/main.js

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

USER nestjs
EXPOSE 3000
CMD ["node", "dist/main.js"]
