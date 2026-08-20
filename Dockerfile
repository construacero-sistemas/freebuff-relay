# Multi-stage lightweight Dockerfile for Freebuff Relay
FROM oven/bun:1-alpine AS base
WORKDIR /app

COPY relay.ts ./

ENV PORT=8787
ENV UPSTREAM=https://www.codebuff.com
EXPOSE 8787

CMD ["bun", "run", "relay.ts"]
