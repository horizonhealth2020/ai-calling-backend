FROM node:20-alpine
WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json tsconfig.base.json ./

# Copy all workspace package.json files
COPY apps/ops-dashboard/package.json apps/ops-dashboard/
COPY packages/ui/package.json packages/ui/
COPY packages/auth/package.json packages/auth/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY packages/socket/package.json packages/socket/
COPY packages/db/package.json packages/db/
COPY prisma ./prisma

# Install
RUN npm ci --include-workspace-root

# Copy source
COPY packages ./packages
COPY apps/ops-dashboard ./apps/ops-dashboard

# Build args baked into Next.js at build time
ARG NEXT_PUBLIC_OPS_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_OPS_API_URL=${NEXT_PUBLIC_OPS_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build --workspace=apps/ops-dashboard

# Runtime
ENV NODE_ENV=production
EXPOSE 3011
CMD ["npm", "run", "start", "--workspace=apps/ops-dashboard"]
