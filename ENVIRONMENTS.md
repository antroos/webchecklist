# 🌍 Environments Overview

## Quick Reference

| Environment | Service Name | URL | Usage |
|-------------|--------------|-----|-------|
| **TEST** 🧪 | `webchecklist-test` | https://webchecklist-test-346608061984.us-central1.run.app | Testing new features |
| **PROD** 🚀 | `webchecklist` | https://webchecklist-346608061984.us-central1.run.app | Live production |

---

## 🔄 Development Workflow

```bash
# 1. Розробка і тестування локально
cd web && npm run dev

# 2. Деплой на TEST
./deploy-test.sh

# 3. Тестування на TEST середовищі
open https://webchecklist-test-346608061984.us-central1.run.app

# 4. Якщо все ОК → деплой на PROD
./deploy-prod.sh
```

---

## 📊 Current Status

### TEST Environment
- **Status:** ✅ Active
- **Revision:** `webchecklist-test-00001-fcl`
- **Last Deploy:** Just now
- **Purpose:** Safe testing ground for new features

### PROD Environment  
- **Status:** ✅ Active
- **Revision:** `webchecklist-00006-qst`
- **Last Deploy:** Previous (stable)
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

