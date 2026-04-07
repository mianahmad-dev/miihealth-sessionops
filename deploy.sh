#!/bin/bash
set -e

# SessionOps Studio — Ubuntu VM deploy script
# Usage: bash deploy.sh

APP_DIR="/opt/sessionops-studio"
REPO_URL="${REPO_URL:-https://github.com/mianahmad-dev/miihealth-sessionops.git}"
NODE_VERSION="20"

echo "==> Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "==> Installing PM2..."
sudo npm install -g pm2

echo "==> Setting up app directory..."
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"

if [ -d "$APP_DIR/.git" ]; then
  echo "==> Pulling latest changes..."
  cd "$APP_DIR"
  git pull
else
  echo "==> Cloning repository..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "==> Installing dependencies..."
npm ci

echo "==> Running database migrations..."
npm run db:migrate

echo "==> Seeding database (only if users table is empty)..."
node -e "
const { createRequire } = require('module');
const r = createRequire(require('path').resolve('.'));
const Database = r('better-sqlite3');
const db = new Database(process.env.DATABASE_URL || './sessionops.db');
const count = db.prepare('SELECT COUNT(*) as c FROM users').get();
db.close();
if (count.c === 0) { process.exit(0); } else { process.exit(1); }
" && npm run db:seed || echo "==> Database already seeded, skipping."

echo "==> Building application..."
npm run build

echo "==> Starting with PM2..."
pm2 delete sessionops-studio 2>/dev/null || true
pm2 start npm --name sessionops-studio -- start
pm2 save
pm2 startup | tail -1 | sudo bash

echo "==> Done. App running at http://localhost:3000"
pm2 status sessionops-studio
