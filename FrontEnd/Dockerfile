FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb* ./

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["bun", "dev"]