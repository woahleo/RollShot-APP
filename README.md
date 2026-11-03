# RollShot-APP

Rollshot connects car owners (and later dealers) with car photographers and videographers, starting in West Palm Beach and South Florida.

Built with Next.js (App Router) and Supabase (sign-in, Postgres, photo storage, live chat).

## What works

- Landing page with a car owner or photographer choice, and a sign-up page with Google, Apple and email links.
- Onboarding: car owners add a car to their garage; photographers pick their city.
- Photographer profile: bio, shoot types, packages, portfolio photos (resized to 2000px WebP in the browser before upload), Instagram and phone.
- Browse shooters by city, see open dates with golden hour times, request a date.
- Photographer dashboard: accept or decline requests, upcoming shoots, open date calendar.
- Rain checks: either side moves a shoot to another open date for free.
- Live chat with a floating chat button. Rules enforced by the database, not the app:
  - before any booking request, a client can send 3 messages;
  - phone numbers, @handles and outside payment apps are blocked until a shoot is confirmed;
  - a photographer's Instagram and phone are visible only to clients with a confirmed shoot.

## Run it

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase SQL editor, paste and run `supabase/migrations/0001_init.sql`.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key (Project Settings > API).
4. In Supabase > Authentication > URL Configuration, set the Site URL to `http://localhost:3000` (and later your real domain), and add `http://localhost:3000/auth/callback` to the redirect URLs.
5. `npm install` then `npm run dev`, and open http://localhost:3000.

Email sign-in links work right away. For Google, add the Google provider in Supabase > Authentication > Providers with a client ID from Google Cloud. Apple needs an Apple Developer account and can wait.

## Deploy

Import the repo on [vercel.com](https://vercel.com), add the two environment variables, deploy, then add the Vercel URL to the Supabase redirect URLs.

## Next up

Stripe deposits, reviews, photo delivery, request board, group shoots at meets, spot guide, Instagram import, and the phone app (Expo).
