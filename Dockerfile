FROM node:22-alpine

WORKDIR /app
RUN chown node:node /app

# Dependencies are locked with bun.lock; Node runs the server (it needs node:sqlite).
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun

# Run everything, including the server, as the unprivileged "node" user.
USER node

COPY --chown=node:node package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY --chown=node:node . .
RUN npm run build && mkdir -p data

EXPOSE 3000
CMD ["npm", "run", "start"]
