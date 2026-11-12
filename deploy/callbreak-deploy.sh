#!/bin/sh
# Installed on the server as /usr/local/bin/callbreak-deploy (root-owned).
# It is the only command the CI deploy key is allowed to run.
set -eu

cd /opt/callbreak
git fetch --quiet origin main
git reset --hard --quiet origin/main
echo "Deploying $(git rev-parse --short HEAD)"

docker compose up -d --build --remove-orphans
# Pick up Caddyfile changes without dropping connections.
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null
docker image prune -f >/dev/null
docker compose ps --format '{{.Service}}: {{.Status}}'
