#!/bin/bash
echo "Deleting ticketing namespace and all resources..."
kubectl delete namespace ticketing
echo "Done."
EOF

chmod +x k8s/teardown.sh