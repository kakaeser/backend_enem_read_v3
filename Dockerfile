# node:22-slim traz npm 10; o lockfile foi gerado com npm 11 (resolução
# de peer deps difere e `npm ci` falha com EUSAGE fora de sync).
# Alinha o npm da imagem com o local antes do install.
FROM node:22-slim AS build
WORKDIR /app
# better-sqlite3 (dev, usado nos testes) compila via node-gyp → precisa de toolchain
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g npm@11
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g npm@11
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/prisma ./prisma
# Cloud Run injeta PORT; app escuta process.env.PORT ?? 3030
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
