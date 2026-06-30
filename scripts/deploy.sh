#!/usr/bin/env bash
# scripts/deploy.sh — Build, import into k3s, and deploy Chatbot-001
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
IMAGE="chatbot/api:${GIT_SHA}"
NAMESPACE="chatbot"
RELEASE="chatbot"
HELM_DIR="$REPO_ROOT/k8s/helm/chatbot"

[[ -f "$REPO_ROOT/.env" ]] && set -a && source "$REPO_ROOT/.env" && set +a

CRM_API_URL="${CRM_API_URL:-http://crm-api.crm.svc.cluster.local:80}"
CRM_API_TOKEN="${CRM_API_TOKEN:-}"
RESEND_API_KEY="${RESEND_API_KEY:-}"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-pozuelomail@gmail.com}"
CHATBOT_HOST="${CHATBOT_HOST:-chatbot.albertopozuelo.com}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

log "=== Building Docker image ==="
sudo docker build -f "$REPO_ROOT/Dockerfile" -t "$IMAGE" "$REPO_ROOT/"
SIZE=$(sudo docker image inspect "$IMAGE" --format='{{.Size}}' | awk '{printf "%.1f MB", $1/1024/1024}')
log "Image built: $IMAGE ($SIZE)"

log "=== Importing image into k3s containerd ==="
sudo docker save "$IMAGE" | sudo k3s ctr images import -
log "Image imported"

log "=== Creating namespace ==="
sudo kubectl get namespace "$NAMESPACE" &>/dev/null || \
  sudo kubectl create namespace "$NAMESPACE"
log "Namespace ready"

log "=== Creating secrets before deploy ==="
sudo kubectl delete secret chatbot-secrets --namespace "$NAMESPACE" 2>/dev/null || true
sudo kubectl create secret generic chatbot-secrets \
  --namespace "$NAMESPACE" \
  --from-literal=crm_api_token="$CRM_API_TOKEN" \
  --from-literal=resend_api_key="$RESEND_API_KEY" \
  --from-literal=notification_email="$NOTIFICATION_EMAIL" \
  --dry-run=client -o yaml | sudo kubectl apply -f -
log "Secrets ready"

log "=== Deploying via Helm ==="
sudo helm upgrade --install "$RELEASE" "$HELM_DIR" \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --set app.image.tag="$GIT_SHA" \
  --set ingress.host="$CHATBOT_HOST"
log "Helm deploy complete"

log "=== Restarting deployment ==="
sudo kubectl rollout restart deployment/chatbot-api -n "$NAMESPACE"
sudo kubectl rollout status deployment/chatbot-api -n "$NAMESPACE" --timeout=3m

log "=== Health check ==="
sleep 3
POD=$(sudo kubectl get pod -n "$NAMESPACE" -l app=chatbot-api -o jsonpath='{.items[0].metadata.name}')
sudo kubectl exec -n "$NAMESPACE" "$POD" -- sh -c "node -e 'const h=require(\"http\"); h.get(\"http://127.0.0.1:3000/api/health\",r=>{let d=\"\";r.on(\"data\",c=>d+=c);r.on(\"end\",()=>{console.log(d);process.exit(+(JSON.parse(d).status!=\"ok\"))})})'" || {
  log "Health check failed!"
  exit 1
}

log "=== Done. Chatbot deployed at https://$CHATBOT_HOST ==="
