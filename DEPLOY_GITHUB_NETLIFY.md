# Put It Online and Keep It Updated (GitHub + Netlify)

This is the easy way to run the app and update it later. You set it up once.
After that, every time you change a form, you just push to GitHub and the
live site updates by itself.

---

## One-time setup

### 1. Put the code on GitHub
1. Make a free account at github.com.
2. Make a new empty repository (call it `pathfile`).
3. From the project folder on your computer, run these in a terminal:
   ```
   git init
   git add .
   git commit -m "First version"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/pathfile.git
   git push -u origin main
   ```
   (Swap in your own GitHub name in that web address.)

### 2. Connect Netlify
1. Make a free account at netlify.com. Sign in with GitHub.
2. Click **Add new site → Import an existing project**.
3. Pick your `pathfile` repository.
4. Netlify reads the settings from the included `netlify.toml`, so you can
   leave the defaults:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click **Deploy**. In a minute you get a live web address.

Done. The app is online.

---

## How you update it after that

Anytime you add or change a form (see HOW_TO_ADD_OR_UPDATE_A_FORM.md):

1. Make your change on your computer and test it (`npm run dev`).
2. Push it up:
   ```
   git add .
   git commit -m "Updated I-130 to new version"
   git push
   ```
3. Netlify sees the push and rebuilds the live site automatically. No extra
   steps. Give it about a minute.

---

## Before you take real payments

The current payment screen is a **demo** — it does not charge anyone. To take
real money, connect a real processor (for example Stripe). The spot to wire it
in is the `Payment` part of `src/App.jsx`, where the demo "Pay" button is.
Until you do that, leave the "Skip payment (demo)" button OFF in your live site
or anyone can unlock for free.

---

## Good habit

Keep a copy of the working `dist` folder, or just trust GitHub — every push is
saved, so you can always go back to an older version if a change breaks
something.
