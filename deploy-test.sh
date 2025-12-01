#!/bin/bash

# Deploy to TEST environment on Cloud Run

set -e

echo "🧪 Deploying to TEST environment..."

# Extract OpenAI API key from .env.local
OPENAI_KEY=$(cat web/.env.local | grep OPENAI_API_KEY | cut -d= -f2)

# Deploy to Cloud Run with -test suffix
gcloud run deploy webchecklist-test \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY="$OPENAI_KEY" \
  --timeout=600 \
  --memory=2Gi \
  --cpu=2 \
  --project=webtest-479911

echo "✅ TEST deployment complete!"
echo "🔗 URL: https://webchecklist-test-346608061984.us-central1.run.app"

