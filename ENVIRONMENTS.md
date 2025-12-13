# 🌍 Environments Overview

## Quick Reference

| Environment | Service Name | URL | Usage |
|-------------|--------------|-----|-------|
| **TEST** 🧪 | `webchecklist-test` | (див. `gcloud run services describe ... value(status.url)`) | Testing new features |
| **PROD** 🚀 | `webchecklist` | https://webmorpher.com | Live production |

---

## 🔄 Development Workflow

```bash
# 1. Розробка і тестування локально
cd web && npm run dev

# 2. Деплой на TEST (рекомендовано — через GitHub Actions)
# push/merge в dev → Deploy (TEST)

# 3. Тестування на TEST середовищі
# Дивись актуальний URL:
gcloud run services describe webchecklist-test --project webtest-479911 --region us-central1 --format='value(status.url)'

# 4. Якщо все ОК → деплой на PROD (рекомендовано — через GitHub Actions)
# PR dev→main, merge main → Deploy (PROD)
```

---

## 📊 Current Status

### TEST Environment
- **Status:** ✅ Active
- **Revision:** (див. `gcloud run services describe webchecklist-test ... value(status.latestReadyRevisionName)`)
- **Last Deploy:** (див. GitHub Actions `Deploy (TEST)`)
- **Purpose:** Safe testing ground for new features

### PROD Environment  
- **Status:** ✅ Active
- **Revision:** (див. `gcloud run services describe webchecklist ... value(status.latestReadyRevisionName)`)
- **Last Deploy:** (див. GitHub Actions `Deploy (PROD)`)
- **Purpose:** Live service for end users

---

## 🎯 Use Cases

### When to use TEST:
- ✅ Testing new features
- ✅ Experimenting with UI changes
- ✅ Validating bug fixes
- ✅ Testing with different URLs/websites
- ✅ Checking logs and performance

### When to deploy to PROD:
- ✅ Feature tested on TEST and works
- ✅ No critical errors in logs
- ✅ CSV generation works correctly
- ✅ All download buttons functional
- ✅ Ready for end users

---

## 🛡️ Safety Features

1. **Separate services** — TEST and PROD are completely isolated
2. **Manual confirmation** — `deploy-prod.sh` asks for confirmation
3. **Rollback available** — Can revert to any previous revision
4. **Independent scaling** — Each environment scales independently

---

## 📈 Next Steps (Optional)

Want to automate this further?

### Option 1: GitHub Actions (CI/CD) ✅ (вже додано)
- Auto-deploy to TEST on push to `dev` branch (`deploy-test.yml`)
- Auto-deploy to PROD on push to `main` branch (`deploy-prod.yml`)
- Requires GitHub Secrets for GCP auth + `OPENAI_API_KEY`

### Option 2: Git Branches
- `dev` branch → TEST environment
- `main` branch → PROD environment
- Pull request required for `dev` → `main`

Let me know if you want me to set this up! 🚀

Already set up: see `DEPLOYMENT.md` and `RUNBOOK.md`.

---

## 🌐 WebMorpher domain notes

When you map a custom domain (e.g. `webmorpher.com`) to Cloud Run:
- Set `NEXTAUTH_URL` to the exact public URL users see.
- Add Google OAuth redirect URI:
  - `https://webmorpher.com/api/auth/callback/google`
- Configure Stripe webhook to hit:
  - `https://webmorpher.com/api/stripe/webhook`

