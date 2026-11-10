FROM node:24-alpine AS build
WORKDIR /workspace
RUN npm install -g --ignore-scripts pnpm@10.15.0
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY packages/design-tokens packages/design-tokens
COPY apps/web apps/web
RUN node packages/design-tokens/scripts/generate.mjs --check && pnpm --filter @inko/web build

FROM node:24-alpine
WORKDIR /workspace
ENV NODE_ENV=production
RUN addgroup -S inko && adduser -S inko -G inko
COPY --from=build --chown=inko:inko /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=inko:inko /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=inko:inko /workspace/apps/web/public ./apps/web/public
USER inko
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
