# WebMorpher — Deploy & Ops Runbook (CTO-safe)

Цей документ — “що робити по кнопках”, щоб **безпечно деплоїти** та **швидко дебажити** прод.

## 0) Одна істина про URLs

- **PROD**: `https://webmorpher.com`
- **TEST**: Cloud Run URL може змінюватись (якщо немає кастомного домену). Дивись актуальний:

```bash
gcloud run services describe webchecklist-test --project webtest-479911 --region us-central1 --format='value(status.url)'
```

### Canonical host правило (важливо)

- `NEXTAUTH_URL` має збігатися з **canonical URL**, який бачить користувач.
- В коді є захист від “двох доменів” (що ламало OAuth): `web/src/middleware.ts` робить 308 redirect на canonical host з `NEXTAUTH_URL`.

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

## 1.1) GitHub guardrails (щоб прод не деплоївся “випадково”)

### A) GitHub Environments
GitHub → Repo → Settings → Environments:
- `production`:
  - Required reviewers: **ти (і/або ще 1 людина)**
  - (optional) Wait timer 2–5 хв

### B) Branch protection для `main`
GitHub → Repo → Settings → Branches → Branch protection rules:
- Require a pull request before merging
- Require approvals (мінімум 1)
- Require status checks to pass (рекомендовано: Deploy(TEST) green + build)
- Block force pushes

### Release cadence (пакетно: 1 раз/день або “коли скажеш”)
1) Протягом дня: feature branches → merge в `dev` (TEST автодеплой).\n
2) Раз на день: створюємо **Release PR** `dev → main`.\n
3) Після тесту: merge PR.\n
4) В `Deploy (PROD)` робимо **Approve and deploy**.\n
5) Smoke-test на PROD (секція нижче).

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

### Billing (мінімум)
- `/app/billing` відкривається після логіну
- `POST /api/billing/checkout?plan=starter|pro` повертає URL Stripe Checkout
- Stripe webhook endpoint відповідає 2xx на події (див. Stripe Dashboard → Webhooks → Attempts)

### Daily release checklist (5–10 хв)
TEST (перед Release PR):
- [ ] `GET <testUrl>/api/auth/providers` → 200 JSON
- [ ] `GET <testUrl>/auth/signin?callbackUrl=%2Fapp` → login → `/app`
- [ ] 1 аналіз у Workspace (переконатись, що /api/agent працює)
- [ ] `GET <testUrl>/app/billing` відкривається після логіну
- [ ] (якщо чіпали billing) checkout відкривається і webhook attempts без помилок

PROD (після approve):
- [ ] `GET https://webmorpher.com/api/auth/providers` → 200 JSON
- [ ] `GET https://webmorpher.com/auth/signin?callbackUrl=%2Fapp` → login → `/app`
- [ ] `/app/billing` відкривається після логіну

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

## 4.1) Stripe webhooks (важливо: TEST vs LIVE)

- **Stripe Test mode** і **Stripe Live mode** мають **окремі webhook endpoints** (і різні `whsec_...`).
- Наш бекенд слухає webhook тільки тут:
  - **PROD**: `https://webmorpher.com/api/stripe/webhook`
  - **TEST**: `<testUrl>/api/stripe/webhook`
- Stripe Workbench може показувати **Destination id / destination client** — **вони не потрібні** для нашого коду.
- Потрібно зберегти тільки:
  - `STRIPE_WEBHOOK_SECRET` = **Signing secret** (`whsec_...`) саме цього endpoint’а (Test або Live)
  - `STRIPE_SECRET_KEY` = `sk_test_...` (TEST) або `sk_live_...` (PROD)
  - `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_METERED` (відповідний режим)

Рекомендовані події для endpoint’а:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

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

## 7) Manual deploy policy (дозволено, але рідко)

Ручний деплой (`gcloud run deploy ...` або `deploy-*.sh`) **дозволений**, але тільки:
- для аварій/rollback/hotfix, або коли GitHub Actions тимчасово не працює;
- з обовʼязковим записом “що деплоїли і чому” (issue/нотатка) і smoke-test після.

Рекомендація: в нормальному циклі **не** деплоїти руками; використовувати `dev` → TEST → PR → `main` → approval → PROD.

---

## 🚨 Disaster checklist (5 хв)

Ціль: **зменшити шкоду за 5 хв**, потім вже спокійно дебажити.

### 1) Stop-the-bleeding (1–2 хв)
- **Швидко зрозуміти масштаб**: чи падає `/`, чи тільки `/app`, чи тільки `/api/*`.
- **Якщо прод критично зламаний** (500/loop/нема логіну):
  - зроби **rollback трафіку** на попередню ревізію (див. секцію Rollback вище)
  - зафіксуй в чаті/нотатках: *яка ревізія була “погана”* і *на яку відкотились*

### 2) Перевірка “must-have” за 60 секунд
PROD (webmorpher.com):
- `GET /api/auth/providers` → має бути JSON
- `GET /api/auth/session` → `{}` якщо не залогінений

Якщо замість цього “server configuration”:
- перевір `NEXTAUTH_URL` + `NEXTAUTH_SECRET` на Cloud Run

### 3) Логи (1–2 хв)
Подивись останні помилки (PROD):

```bash
gcloud run logs read webchecklist --project webtest-479911 --region us-central1 --limit=200
```

В першу чергу шукай:
- `NO_SECRET` / `Invalid URL` (NextAuth env)
- `PERMISSION_DENIED` (Firestore/Stripe/Secrets)
- `OAUTH_CALLBACK_ERROR` (часто cookies/state після попередніх фейлів)

### 4) Якщо проблема в secrets / env vars
1) Виправ у GitHub `Settings → Environments → production`
2) Зроби redeploy (порожній commit)
3) Пройди approval gate
4) Smoke-test (секція Smoke-test)

### 5) Після стабілізації (post-incident)
- Запиши: причина → фікс → як виявити → як запобігти.
- Додай пункт у `RUNBOOK.md`, якщо це повторювана штука.


