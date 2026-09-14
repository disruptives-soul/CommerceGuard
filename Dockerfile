FROM mcr.microsoft.com/playwright:v1.47.2-jammy

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run check

ENV NODE_ENV=production

CMD ["pnpm", "run", "scheduler", "--", "configs/scheduler.car-one.staging.slack.json"]
