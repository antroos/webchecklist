#!/bin/bash

# Deploy to PRODUCTION environment on Cloud Run

set -e

echo "🚀 Deploying to PRODUCTION environment..."
echo "⚠️  Are you sure? This will update the live production service."
read -p "Press Enter to continue or Ctrl+C to cancel..."

get_env() {
  local key="$1"
  if [ -f "web/.env.local" ] && grep -q "^${key}=" "web/.env.local"; then
    # Preserve everything after the first '=' (values may contain '=')
    sed -n "s/^${key}=//p" "web/.env.local" | head -n 1
  else
    # Fallback to existing shell env var
    printenv "$key" || true
  fi
}

OPENAI_KEY="$(get_env OPENAI_API_KEY)"
GOOGLE_CLIENT_ID="$(get_env GOOGLE_CLIENT_ID)"
GOOGLE_CLIENT_SECRET="$(get_env GOOGLE_CLIENT_SECRET)"
NEXTAUTH_SECRET="$(get_env NEXTAUTH_SECRET)"
NEXTAUTH_URL="$(get_env NEXTAUTH_URL)"
STRIPE_SECRET_KEY="$(get_env STRIPE_SECRET_KEY)"
STRIPE_WEBHOOK_SECRET="$(get_env STRIPE_WEBHOOK_SECRET)"
STRIPE_PRICE_STARTER="$(get_env STRIPE_PRICE_STARTER)"
STRIPE_PRICE_PRO="$(get_env STRIPE_PRICE_PRO)"
STRIPE_PRICE_METERED="$(get_env STRIPE_PRICE_METERED)"
FIREBASE_SERVICE_ACCOUNT_BASE64="$(get_env FIREBASE_SERVICE_ACCOUNT_BASE64)"
GCS_BUCKET="$(get_env GCS_BUCKET)"

# Reasonable default for prod if NEXTAUTH_URL isn't set explicitly
if [ -z "$NEXTAUTH_URL" ]; then
  NEXTAUTH_URL="https://webchecklist-346608061984.us-central1.run.app"
fi

# Deploy to Cloud Run (production service)
gcloud run deploy webchecklist \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY="$OPENAI_KEY",GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID",GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET",NEXTAUTH_SECRET="$NEXTAUTH_SECRET",NEXTAUTH_URL="$NEXTAUTH_URL",STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY",STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET",STRIPE_PRICE_STARTER="$STRIPE_PRICE_STARTER",STRIPE_PRICE_PRO="$STRIPE_PRICE_PRO",STRIPE_PRICE_METERED="$STRIPE_PRICE_METERED",FIREBASE_SERVICE_ACCOUNT_BASE64="$FIREBASE_SERVICE_ACCOUNT_BASE64",GCS_BUCKET="$GCS_BUCKET" \
  --timeout=600 \
  --memory=2Gi \
  --cpu=2 \
  --project=webtest-479911

echo "✅ PRODUCTION deployment complete!"
echo "🔗 URL: https://webchecklist-346608061984.us-central1.run.app"

