# 🌍 Environments Overview

## Quick Reference

| Environment | Service Name | URL | Usage |
|-------------|--------------|-----|-------|
| **TEST** 🧪 | `webchecklist-test` | (див. `gcloud run services describe ... value(status.url)`) | Testing new features |
| **PROD** 🚀 | `webchecklist` | https://webmorpher.com | Live production |

---

## ✅ Canonical URL rule (важливо для Google OAuth)

Для кожного середовища є **канонічний URL**, який має збігатися з `NEXTAUTH_URL`.

- **PROD canonical**: `https://webmorpher.com`
- **TEST canonical**: `gcloud run services describe webchecklist-test ... value(status.url)` (це зазвичай `https://webchecklist-test-<hash>.a.run.app`)

Чому це важливо: якщо відкривати TEST/PROD через інший домен (наприклад `...run.app` з project-number), cookies NextAuth можуть “розʼїхатись” між доменами → OAuth може падати або вимагати повторний клік.

У коді є захист: `web/src/middleware.ts` робить 308 redirect на canonical host з `NEXTAUTH_URL`.

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

## 📈 Release cadence (пакетно)

- Працюємо в feature branches → merge в `dev` → автодеплой на TEST.
- **Раз на день** (або “коли власник скаже”) робимо один Release PR `dev → main`.
- PROD деплой відбувається тільки після **Approve and deploy** (GitHub Environment `production`).

---

## 🌐 WebMorpher domain notes

When you map a custom domain (e.g. `webmorpher.com`) to Cloud Run:
- Set `NEXTAUTH_URL` to the exact public URL users see.
- Add Google OAuth redirect URI:
  - `https://webmorpher.com/api/auth/callback/google`
- Configure Stripe webhook to hit:
  - `https://webmorpher.com/api/stripe/webhook`

For TEST, recommended:
- Use the canonical Cloud Run URL from `status.url` OR map `test.webmorpher.com` to `webchecklist-test` and set `NEXTAUTH_URL` accordingly.

