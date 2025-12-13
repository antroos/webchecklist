# WebMorpher — Deploy & Ops Runbook (CTO-safe)

Цей документ — “що робити по кнопках”, щоб **безпечно деплоїти** та **швидко дебажити** прод.

## 0) Одна істина про URLs

- **PROD**: `https://webmorpher.com`
- **TEST**: Cloud Run URL може змінюватись (якщо немає кастомного домену). Дивись актуальний:

```bash
gcloud run services describe webchecklist-test --project webtest-479911 --region us-central1 --format='value(status.url)'
```

## 1) Як деплоїти (рекомендовано)

### TEST (авто)
- **Тригер**: push в `dev`
- **Workflow**: `Deploy (TEST)`
- **Сервіс**: `webchecklist-test`

Кроки:
1) Змердж/запуш зміни в `dev`
2) Дочекайся зеленого `Deploy (TEST)`
3) Smoke-test на TEST (див. нижче)

### PROD (з approval)
- **Тригер**: push в `main` (або ручний `workflow_dispatch`)
- **Workflow**: `Deploy (PROD)`
- **Сервіс**: `webchecklist`
- **Захист**: GitHub Environment `production` з required approval

Кроки:
1) PR `dev → main` (review)
2) Merge в `main`
3) В `Deploy (PROD)` натисни **Approve and deploy**
4) Smoke-test на PROD (див. нижче)

## 2) Smoke-test (після кожного деплою)

### Auth (має працювати в першу чергу)
- **Providers**: `GET /api/auth/providers` має повертати JSON (не 404 і не “server configuration”)
- **Sign-in UI**: `/auth/signin` має показувати кнопку Google
- **Login flow**: натиснути “Continue with Google” → після consent має перекинути в `/app`

Для PROD:
- `https://webmorpher.com/api/auth/providers`
- `https://webmorpher.com/auth/signin?callbackUrl=%2Fapp`

Для TEST:
- `<testUrl>/api/auth/providers`
- `<testUrl>/auth/signin?callbackUrl=%2Fapp`

### Основний сервіс
- `/app` без сесії має редіректити на `/auth/signin?callbackUrl=/app`
- після логіну `/app` має відкривати основний інтерфейс

## 3) “Нічого не працює, але я міняв secrets”

Секрети в GitHub **не застосовуються**, доки не відбувся **новий деплой**.

Швидкий варіант “підняти redeploy”:

```bash
git commit --allow-empty -m "chore: redeploy"
git push
```

## 4) Обовʼязкові secrets (мінімум для auth)

У GitHub → `Settings → Environments`:

### `test` environment secrets
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL` = актуальний TEST URL
- `NEXTAUTH_SECRET`

### `production` environment secrets
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL` = `https://webmorpher.com`
- `NEXTAUTH_SECRET`

## 5) Часті помилки і 2-хв рішення

### A) `/api/auth/providers` → “There is a problem with the server configuration…”
Причина: майже завжди порожні `NEXTAUTH_URL` або `NEXTAUTH_SECRET` на Cloud Run.

Перевір:

```bash
gcloud run services describe webchecklist --project webtest-479911 --region us-central1 \
  --format='json(spec.template.spec.containers[0].env)'
```

Фікс:
- додай/онови `NEXTAUTH_URL` + `NEXTAUTH_SECRET` у GitHub environment secrets
- зроби redeploy

### B) Google login → `PERMISSION_DENIED: Cloud Firestore API ... disabled`
Причина: Firestore API/DB не створені, або runtime service account не має доступу.

Фікс (one-time):
1) Увімкнути `firestore.googleapis.com`
2) Створити Firestore database `(default)`
3) Видати Cloud Run runtime SA роль `roles/datastore.user`

### C) `OAuthCallbackError: State cookie was missing`
Причина: “поламаний” OAuth state cookie (часто після кількох невдалих спроб).

Фікс:
- повторити логін в **інкогніто**, або очистити cookies для `webmorpher.com`

## 6) Rollback (якщо прод зламався)

```bash
gcloud run revisions list --service=webchecklist --project webtest-479911 --region us-central1
gcloud run services update-traffic webchecklist --project webtest-479911 --region us-central1 \
  --to-revisions=<revisionName>=100
```


