FROM node:20-alpine

RUN npm install --registry="https://mirror-npm.runflare.com" -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml* .npmrc ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    pnpm config set store-dir /root/.local/share/pnpm/store/v3 && \
    pnpm install

COPY . .

EXPOSE 3000

CMD ["pnpm", "run", "dev"]