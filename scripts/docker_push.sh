#!/usr/bin/env bash
set -euo pipefail

IMAGE="sarvajithsankar/battery-health-predictor"
TAG="${1:-latest}"

echo "==> Building $IMAGE:$TAG"
docker build -t "$IMAGE:$TAG" .

echo "==> Tagging as latest"
docker tag "$IMAGE:$TAG" "$IMAGE:latest"

echo "==> Pushing to Docker Hub"
docker push "$IMAGE:$TAG"
docker push "$IMAGE:latest"

echo "✓ Done. Pull with:"
echo "    docker pull $IMAGE:latest"
