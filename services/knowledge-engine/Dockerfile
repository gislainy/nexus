FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npm install -g pnpm@10 && pnpm install --prod=false && pnpm prisma generate && pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 8004
CMD ["node", "dist/index.js"]
