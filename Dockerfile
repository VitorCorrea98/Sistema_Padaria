FROM node:24.5-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]