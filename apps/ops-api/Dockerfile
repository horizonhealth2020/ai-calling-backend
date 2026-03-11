FROM node:20-alpine AS base
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/ops-api/package.json apps/ops-api/
COPY packages/auth/package.json packages/auth/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/

# Install dependencies
RUN npm ci --workspace=@ops/ops-api --include-workspace-root

# Copy source
COPY prisma ./prisma
COPY packages ./packages
COPY apps/ops-api ./apps/ops-api
COPY tsconfig.base.json ./

# Generate Prisma client
RUN npx prisma generate --schema=prisma/schema.prisma

EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && npx tsx apps/ops-api/src/index.ts"]
