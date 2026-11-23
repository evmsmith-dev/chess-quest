# Setting up Firebase for online play

Online play needs a free Firebase project. It takes about 10 minutes and no payment card: the
no-cost **Spark** plan is enough for about 50 games at the same time.

## 1. Create the project

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. Click **Create a project** (or **Add project**) and name it, for example `chess-quest`.
3. When it asks about **Google Analytics**, turn it **off**. The app doesn't use analytics, and
   leaving it off keeps children's data out of tracking.
4. Click **Create project**, then **Continue**.

## 2. Turn on anonymous sign-in

1. In the left menu: **Security → Authentication → Get started**. (Firebase moves its menu around
   from time to time. If you can't find something, type its name in the search box at the top of
   the console, or open **All products** at the bottom of the menu. On a phone, the menu is behind
   the ☰ button.)
2. On the **Sign-in method** tab, choose **Anonymous**, switch it on, and **Save**.

Players never see a sign-in: the app gets a random player number in the background.

## 3. Create the database

1. Open **Realtime Database** (search for it, or find it under **All products**) and click
   **Create database**. Make sure it's *Realtime Database*, not *Firestore*.
2. Pick the location nearest your players (for the US: `us-central1`), then **Next**.
3. Choose **Start in locked mode** and click **Enable**.
4. Open the **Rules** tab, delete everything there, paste the whole contents of
   [`database.rules.json`](../database.rules.json) from this repo, and click **Publish**.

The rules let only the two players of a game change it, only on their own turn, and let anyone
delete a game once it's more than 7 days old. Without them, the database refuses everything.

## 4. Register the web app and copy its settings

1. Click the gear ⚙️ next to **Project overview → Project settings**.
2. Under **Your apps**, click the web icon **</>**.
3. Give it a nickname (`Chess Quest`). Leave **Firebase Hosting** unticked. Click **Register app**.
4. Firebase shows a `firebaseConfig = { … }` block. It must include a `databaseURL` line (it will,
   if you created the database first). Copy the whole block.
5. Put it in [`src/online/config.js`](../src/online/config.js) as
   `export const FIREBASE_CONFIG = { … };` (in place of `null`), or paste it to Claude to do. These values are safe to publish: they only name the project. The database
   rules are what protect it.

## 5. Allow your site's address

1. **Security → Authentication → Settings → Authorized domains → Add domain**.
2. Add `evmsmith-dev.github.io`.

Push the change. Once GitHub Pages has deployed it, **Play online** works.

## 6. App Check (recommended)

App Check makes Firebase accept requests only from the real Chess Quest app, not from scripts
that copied the settings above. It's invisible to players: reCAPTCHA Enterprise checks quietly in
the background and never shows a puzzle.

**Order matters:** turn on *enforcement* last. If you enforce before the app sends App Check
tokens, online play stops working.

1. **Make a reCAPTCHA key.** Open <https://console.cloud.google.com/security/recaptcha> and pick
   the same project at the top (`chess-quest-…`). If asked, enable the reCAPTCHA Enterprise API.
   Click **Create key**: type *Website*, name `Chess Quest`, domain `evmsmith-dev.github.io`. Leave
   **Use checkbox challenge** off. Create it and copy the **key ID** (a long string starting with
   `6L`).
2. **Register the app with App Check.** In the Firebase console: **Security → App Check → Apps**.
   Choose the web app, pick **reCAPTCHA Enterprise**, paste the key ID, and save. Leave the
   threshold at 0.5.
3. **Put the key in the app.** In [`src/online/config.js`](../src/online/config.js) set
   `export const APP_CHECK_SITE_KEY = "6L…";` (or paste it to Claude). Push, and wait for the deploy.
4. **Check it's working.** Play an online game, then look at **App Check → APIs → Realtime
   Database**. After a few hours the chart should show almost all requests as **Verified**.
5. **Enforce.** On that same page, click **Enforce** for **Realtime Database**. From then on,
   requests without a valid App Check token are refused.

reCAPTCHA Enterprise has a free monthly allowance that's far more than a chess app needs. If the
Google Cloud console insists on a billing account before creating the key, use classic
**reCAPTCHA v3** instead, which never needs one: create a v3 key at
<https://www.google.com/recaptcha/admin/create> (domain `evmsmith-dev.github.io`), choose
**reCAPTCHA** (not Enterprise) in step 2 and paste the *secret key* there, and in step 3 set
`APP_CHECK_SITE_KEY` to the *site key* and `APP_CHECK_PROVIDER = "v3"`.
Players who installed an older version get the App Check update the next time they tap **Update**.
Enforce only after most of them have done that (a few days), or they'll see "Couldn't connect"
until they update.

## Optional: clean up old player numbers

Under **Authentication → Sign-in method → Anonymous** you can turn on **automatic clean-up**,
which deletes anonymous player numbers 30 days after they were made. It needs the free upgrade to
*Firebase Authentication with Identity Platform*. Skip it if the console asks for a payment card.

## Good to know

- **Cost:** the Spark plan never bills. If it's full (100 connections at once), more players get
  "Couldn't connect" until someone leaves.
- **Clean-up:** games are deleted 7 days after they're created. The app tidies old ones whenever
  someone opens online play.
- **Changing the rules later:** paste the new `database.rules.json` into the **Rules** tab again. Do it whenever an update says the rules changed: new features (clocks, friends, daily stats) are refused by older rules until you do.
- **Trust:** both phones check every move with the same rules engine, so a tampered app can't
  play an illegal move. A game result is trusted from the players' phones, which is fine for
  games between friends but not for prizes or rankings.
