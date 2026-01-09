#!/bin/bash

GPU_AVAILABLE=$(python -c 'import torch; print(torch.cuda.is_available())')
CONCURRENCY=${WORKER_CONCURRENCY:-4}

echo "GPU available: ${GPU_AVAILABLE}"
echo "Worker concurrency: ${CONCURRENCY}"

if [ "${GPU_AVAILABLE}" = "True" ]; then
    echo "GPU Device: $(python -c 'import torch; print(torch.cuda.get_device_name(0))')"
    echo "Starting Celery worker with pool=threads --concurrency=${CONCURRENCY} (GPU mode)"
    exec celery -A celery_app worker --loglevel=info --pool=threads --concurrency=${CONCURRENCY}
else
    echo "Starting Celery worker with concurrency=${CONCURRENCY} (CPU mode)"
    exec celery -A celery_app worker --loglevel=info --concurrency=${CONCURRENCY}
fi
