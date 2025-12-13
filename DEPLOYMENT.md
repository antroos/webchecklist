# Deployment Guide

## Середовища (Environments)

У проєкті є два середовища:

### 🧪 TEST (Staging)
- **Service:** `webchecklist-test`
- **URL:** https://webchecklist-test-346608061984.us-central1.run.app
- **Призначення:** Тестування нових фіч перед prod

### 🚀 PRODUCTION
- **Service:** `webchecklist`
- **URL:** https://webchecklist-346608061984.us-central1.run.app
- **Призначення:** Live сервіс для користувачів

---

## 📋 Workflow розробки

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│  Coding  │  →   │   TEST   │  →   │   PROD   │
│  Locally │      │ (Staging)│      │  (Live)  │
└──────────┘      └──────────┘      └──────────┘
```

## ✅ TL;DR — як деплоїти “правильно і безпечно”

### URLs
- **TEST:** https://webchecklist-test-346608061984.us-central1.run.app
- **PROD:** https://webchecklist-346608061984.us-central1.run.app

### Рекомендований шлях (через GitHub Actions)
1. **Пуш/мерж в `dev`** → автодеплой на **TEST** (workflow `Deploy (TEST)`).
2. Перевір на TEST:
   - відкрити сайт
   - прогнати 1–2 URL (наприклад `snoopgame.com`)
   - перевірити, що генерується CSV і працюють кнопки Download
3. **PR `dev → main`** (code review).
4. **Merge в `main`** → автодеплой на **PROD** (workflow `Deploy (PROD)`).
   - Для максимальної безпеки увімкни GitHub Environment `production` з Required reviewers (тоді буде manual approval).

### Якщо GitHub Actions тимчасово не працює (fallback)
- Деплой руками скриптами:
  - `./deploy-test.sh`
  - `./deploy-prod.sh`

### 1️⃣ Розробка локально

```bash
# Запуск Next.js dev server
cd web
npm run dev

# Тестування з реальним Python
# (Python має бути встановлений локально в browser-service/venv)
```

---

### 2️⃣ Деплой на TEST

```bash
# Деплоїмо на test середовище
./deploy-test.sh
```

Після деплою:
- ✅ Перевір https://webchecklist-test-*.run.app
- ✅ Протестуй всі нові фічі
- ✅ Переконайся, що логи працюють
- ✅ Перевір різні URL (snoopgame.com, langfuse.com, тощо)

---

### 3️⃣ Деплой на PRODUCTION

**Тільки після успішного тестування на TEST!**

```bash
# Деплоїмо на production
./deploy-prod.sh
```

Скрипт попросить підтвердження перед деплоєм на prod.

---

## 🛠️ Manual Deployment Commands

### Deploy to TEST:
```bash
gcloud run deploy webchecklist-test \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY=your-key-here \
  --timeout=600 \
  --memory=2Gi \
  --cpu=2 \
  --project=webtest-479911
```

### Deploy to PROD:
```bash
gcloud run deploy webchecklist \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY=your-key-here \
  --timeout=600 \
  --memory=2Gi \
  --cpu=2 \
  --project=webtest-479911
```

---

## 📝 Rollback (відкат на попередню версію)

Якщо щось пішло не так на prod:

```bash
# Список всіх ревізій
gcloud run revisions list --service=webchecklist --region=us-central1

# Rollback на попередню версію
gcloud run services update-traffic webchecklist \
  --region=us-central1 \
  --to-revisions=webchecklist-00006-qst=100
```

---

## 🔍 Viewing Logs

### TEST logs:
```bash
gcloud run logs read webchecklist-test --region=us-central1 --limit=100
```

### PROD logs:
```bash
gcloud run logs read webchecklist --region=us-central1 --limit=100
```

### Real-time logs:
```bash
gcloud run logs tail webchecklist --region=us-central1
```

---

## 🌐 Environment Variables

Обидва середовища використовують:
- `OPENAI_API_KEY` — з `web/.env.local`
- `NODE_ENV=production` — встановлюється автоматично
- `PORT=8080` — встановлюється в Dockerfile

---

## 🤖 GitHub Actions CI/CD (автодеплой)

У репозиторії є workflow-и:
- `/.github/workflows/deploy-test.yml` — **push в `dev`** → деплой на **Cloud Run TEST** (`webchecklist-test`)
- `/.github/workflows/deploy-prod.yml` — **push в `main`** → деплой на **Cloud Run PROD** (`webchecklist`)

### Що потрібно налаштувати (разово в GCP)

Рекомендований спосіб — **Workload Identity Federation (OIDC)** (без зберігання JSON ключів у GitHub).

GitHub Secrets, які мають бути додані в репозиторій:
- `GCP_PROJECT_ID` — наприклад `webtest-479911`
- `GCP_REGION` — наприклад `us-central1`
- `GCP_WIF_PROVIDER` — resource name провайдера WIF (OIDC)
- `GCP_SA_EMAIL` — email service account (наприклад `github-deployer@...`)
- `OPENAI_API_KEY` — ключ OpenAI (буде переданий в Cloud Run як env var)

### GitHub Environments (рекомендовано)
Створи environments:
- `test` — без approval
- `production` — з Required reviewers (manual approval на прод деплой)

### Примітка
- Локальні скрипти `deploy-*.sh` читають `OPENAI_API_KEY` з `web/.env.local`.
- CI/CD workflow-и беруть `OPENAI_API_KEY` з GitHub Secrets і передають його через `--set-env-vars`.

---

## ✅ Checklist перед prod deployment

- [ ] Код протестований локально
- [ ] Задеплоєно і протестовано на TEST
- [ ] Логи на TEST виглядають нормально
- [ ] Перевірено різні URL на TEST
- [ ] CSV файли генеруються коректно
- [ ] Немає критичних помилок у логах
- [ ] Git commit створений з описом змін
- [ ] Готовий до деплою на PROD

---

## 🚨 Troubleshooting

### Якщо TEST не працює:
1. Перевір логи: `gcloud run logs read webchecklist-test`
2. Перевір, чи встановився Python: логи білда
3. Перевір `.env.local` — чи є там `OPENAI_API_KEY`

### Якщо потрібно видалити TEST service:
```bash
gcloud run services delete webchecklist-test --region=us-central1
```

