#!/bin/bash

# Deploy to PRODUCTION environment on Cloud Run

set -e

echo "🚀 Deploying to PRODUCTION environment..."
echo "⚠️  Are you sure? This will update the live production service."
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Extract OpenAI API key from .env.local
OPENAI_KEY=$(cat web/.env.local | grep OPENAI_API_KEY | cut -d= -f2)

# Deploy to Cloud Run (production service)
gcloud run deploy webchecklist \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY="$OPENAI_KEY" \
  --timeout=600 \
  --memory=2Gi \
  --cpu=2 \
  --project=webtest-479911

echo "✅ PRODUCTION deployment complete!"
echo "🔗 URL: https://webchecklist-346608061984.us-central1.run.app"

