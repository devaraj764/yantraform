# ---- Build stage ----
FROM node:22 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends wireguard-tools iptables iproute2 && \
    rm -rf /var/lib/apt/lists/*

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
