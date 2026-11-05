# Rollshot iPhone app

A Capacitor shell around the live site (`capacitor.config.ts`). Site changes reach the app as soon as
they deploy; only native changes (icon, permissions, plugins) need a new build in Xcode.

```sh
npm install
npx cap sync ios     # copies the config and plugins into ios/
npx cap open ios     # opens the project in Xcode
```

- App icon and splash: `python3 scripts/app-icons.py <icon path> <splash path>` (see the script).
- Push: the app saves its Apple push address as `apns:<token>`; `/api/push` sends to Apple with
  `APNS_KEY`, `APNS_KEY_ID` and `APNS_TEAM_ID` from Vercel. Migration `0030_app_push.sql`.
- Sign-in in the app: email code (the Supabase magic link email must include `{{ .Token }}`) or Apple.
  Google is hidden because Google blocks sign-in inside apps.
- Apple's reviewers sign in as `applereview@rollshot.app` with a password (see `src/lib/app.ts`).
