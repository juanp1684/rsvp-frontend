#!/bin/bash
set -e

git pull

docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

echo "Frontend deployed successfully."
