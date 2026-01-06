#!/bin/bash

# Setup environment files for development

# Root .env
cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://n8nback:n8nback_dev_password@localhost:5432/n8nback

# Redis
REDIS_URL=redis://localhost:6379

# Encryption key (32 bytes base64 encoded)
# Generate with: openssl rand -base64 32
APP_ENCRYPTION_KEY=dGhpc2lzYXNlY3JldGtleWZvcmRldmVsb3BtZW50IS==

# API
PORT=3001
HOST=0.0.0.0
WEB_URL=http://localhost:3000

# Mock n8n (for local development)
MOCK_N8N_URL=http://localhost:5678

# Worker
POLL_INTERVAL_MS=300000
EOF

# API .env
cat > apps/api/.env << 'EOF'
# Database
DATABASE_URL=postgresql://n8nback:n8nback_dev_password@localhost:5432/n8nback

# Redis
REDIS_URL=redis://localhost:6379

# Encryption key (32 bytes base64 encoded)
APP_ENCRYPTION_KEY=dGhpc2lzYXNlY3JldGtleWZvcmRldmVsb3BtZW50IS==

# API
PORT=3001
HOST=0.0.0.0
WEB_URL=http://localhost:3000

# Mock n8n
MOCK_N8N_URL=http://localhost:5678

# Worker
POLL_INTERVAL_MS=300000
EOF

# Web .env
cat > apps/web/.env << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF

echo "✅ Environment files created!"
echo ""
echo "Next steps:"
echo "1. cd infra && docker compose up -d postgres redis mock-n8n"
echo "2. pnpm db:generate && pnpm db:push && pnpm db:seed"
echo "3. pnpm dev"



