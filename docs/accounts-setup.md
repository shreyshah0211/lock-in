# Turning on real accounts

Lock In signs people in with a 6-digit code sent to their email, and keeps accounts,
friends and photos in a Supabase project. Until the steps below are done, the app
opens on the sign-in screen and says it is not connected to its server.

These steps are yours to do: they create an account with an outside service and
handle its keys. They take about 15 minutes.

## 1. Create the project

1. Go to supabase.com, sign up, and create a new project (the free plan is enough to start).
2. Pick a region near your users and set a database password. Keep that password
   somewhere safe; the app never needs it.

## 2. Create the tables and rules

1. In the project, open **SQL Editor**.
2. Paste in all of `supabase/schema.sql` from this repo and press **Run**.
3. It should finish with "Success. No rows returned".

## 3. Make the email carry a code

By default Supabase emails a link. Lock In asks for a code typed into the app.

1. Open **Authentication**, then **Emails** (or **Email Templates**).
2. Edit both **Magic Link** and **Confirm signup** so the message shows the code:

   ```
   Your Lock In code is {{ .Token }}
   ```

3. Under **Authentication**, **Sign In / Providers**, **Email**: keep Email on. The code
   length should be 6.

Supabase's built-in email only sends a few messages an hour and is meant for testing.
Before real people join, connect your own email sender under **Authentication**, **SMTP
Settings** (Resend, Postmark and similar services have free plans).

## 4. Tell the app where the server is

1. In Supabase open **Project Settings**, then **API** (or **Data API** and **API Keys**).
2. Copy the **Project URL** and the **publishable** key (older projects call it the
   **anon public** key). Never use the **secret** or **service_role** key here.
3. In this repo, copy `backend.example.json` to `backend.json` and paste the two values in:

   ```json
   { "url": "https://abcdefgh.supabase.co", "key": "sb_publishable_..." }
   ```

`backend.json` is ignored by git. The publishable key is not a secret (every copy of the
app carries it); what protects people's data is the rules in `schema.sql`.

## 5. Build and install

```bash
zsh tools/install-iphone.sh
```

The build prints `server: https://...` when it found `backend.json`. Open the app, enter
your email, type the code, pick a username. To test friends, sign in on a second phone
(or have a friend install it) and add each other by username.

## What is and is not saved to the account

- Saved: your streak, check-ins, meals, lifts, goals, weights, and your photos.
- Seen by friends you accepted: your name, username, gym, streak clock, and check-in photos.
- Never leaves the phone: locked rewards, your gym's location and visits.

## Before strangers use it

- A privacy policy and terms, since you now hold people's emails and photos.
- Your own email sender (step 3).
- A way to report or block a person. There is none yet.
- Lock In has no comments, reactions or nudges between real friends yet.
