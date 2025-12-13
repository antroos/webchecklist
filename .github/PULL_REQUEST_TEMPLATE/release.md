## Release PR (dev → main)

### Summary
- What’s included in this release:
  - 

### TEST verification (required)
- [ ] Deploy (TEST) is green for the latest `dev` commit
- [ ] TEST OAuth works (first try):
  - [ ] `GET /api/auth/providers` returns 200 JSON
  - [ ] `/auth/signin?callbackUrl=%2Fapp` → Google login → `/app`
- [ ] Workspace works (generate one checklist)
- [ ] Billing page loads (`/app/billing`)
- [ ] (If billing changed) Checkout session works in TEST Stripe

### PROD rollout (after merge)
- [ ] Merge PR
- [ ] In GitHub Actions `Deploy (PROD)` click **Approve and deploy**
- [ ] PROD smoke-test:
  - [ ] `https://webmorpher.com/api/auth/providers` returns 200 JSON
  - [ ] `https://webmorpher.com/auth/signin?callbackUrl=%2Fapp` login → `/app`
  - [ ] `/app/billing` opens for logged-in user

### Notes / Risks
- 


