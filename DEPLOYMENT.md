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

