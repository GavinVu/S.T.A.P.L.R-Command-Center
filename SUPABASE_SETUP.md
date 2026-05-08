# Project S.T.A.P.L.R. Supabase Setup

This app is a static Cloudflare Pages site that uses Supabase for shared cloud data.

## 1. Create Supabase Project

1. Go to https://supabase.com.
2. Create a new project.
3. Open the project dashboard.

## 2. Create the Shared App Table

1. In Supabase, open **SQL Editor**.
2. Open this repo file: `supabase-setup.sql`.
3. Paste the whole SQL file into Supabase SQL Editor.
4. Click **Run**.

This creates one shared app-state row for projects, accounts, funding, logs, and chats.

## 3. Add Your Supabase URL and Public Key

1. In Supabase, go to **Project Settings** -> **API**.
2. Copy:
   - **Project URL**
   - **anon public key**
3. Open `supabase-config.js`.
4. Replace the placeholders:

```js
window.STAPLR_SUPABASE_CONFIG = {
  url: "https://YOUR-PROJECT-REF.supabase.co",
  anonKey: "YOUR-SUPABASE-ANON-PUBLIC-KEY"
};
```

Example shape:

```js
window.STAPLR_SUPABASE_CONFIG = {
  url: "https://abcdefghijk.supabase.co",
  anonKey: "eyJhbGciOi..."
};
```

The anon key is safe to publish in frontend apps. Do not put the service role key in this file.

## 4. Commit and Push

```powershell
git add index.html app.js supabase-config.js supabase-setup.sql SUPABASE_SETUP.md
git commit -m "Connect app to Supabase"
git push
```

## 5. Cloudflare Pages Settings

Use these settings:

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `/` or blank/root

## Default Admin Login

- Username: `Admin`
- Password: `STAPLRPr0jects!?`

## Important Security Note

This version uses a simple shared Supabase state row so everyone sees the same data. Passwords are hashed before storage, but this is still a lightweight prototype auth system. For a production-grade club portal, the next upgrade should be Supabase Auth with row-level rules per user/project.
