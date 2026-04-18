#!/bin/bash
set -e

echo "=== Building Docker images ==="
eval $(minikube docker-env)

SERVICES=(auth-service event-service seat-inventory-service booking-service payment-service notification-service api-gateway)

echo ""
echo "=== Applying Kubernetes manifests ==="

kubectl apply -f k8s/namespace/
echo "Waiting for namespace..."
sleep 2

kubectl apply -f k8s/config/
kubectl apply -f k8s/infra/

echo "Waiting for infrastructure to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n ticketing --timeout=120s
kubectl wait --for=condition=ready pod -l app=mongodb -n ticketing --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n ticketing --timeout=120s
kubectl wait --for=condition=ready pod -l app=kafka -n ticketing --timeout=120s

echo ""
echo "=== Deploying services ==="
kubectl apply -f k8s/services/

echo ""
echo "Waiting for all services to be ready..."
kubectl wait --for=condition=ready pod -l app=api-gateway -n ticketing --timeout=180s || true

echo ""
echo "=== Status ==="
kubectl get pods -n ticketing
echo ""
echo "API Gateway: $(minikube service api-gateway -n ticketing --url 2>/dev/null || echo 'http://localhost:30080')"
echo "Mailhog UI: kubectl port-forward svc/mailhog 8025:8025 -n ticketing"
EOF

chmod +x k8s/deploy.sh