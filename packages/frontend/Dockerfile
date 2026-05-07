# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/frontend ./packages/frontend

# Build shared-types first, then frontend
RUN pnpm --filter @saas/shared-types build
RUN pnpm --filter frontend build

# ---- Production stage ----
FROM nginx:alpine

COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
