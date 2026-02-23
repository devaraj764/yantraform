# ---- Build stage ----
FROM node:22-alpine AS build

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine

RUN apk add --no-cache wireguard-tools iptables iproute2

WORKDIR /app

COPY --from=build /app/.output .output

# Persistent database volume
VOLUME /app/data

ENV PORT=51821
ENV HOST=0.0.0.0

EXPOSE 51821

# Requires: docker run --cap-add NET_ADMIN --cap-add NET_RAW
# NET_ADMIN: needed for WireGuard interface management and firewall rules
# NET_RAW:   needed for low-level network operations
CMD ["node", ".output/server/index.mjs"]
