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

1. In the left menu: **Build → Authentication → Get started**.
2. On the **Sign-in method** tab, choose **Anonymous**, switch it on, and **Save**.

Players never see a sign-in: the app gets a random player number in the background.

## 3. Create the database

1. In the left menu: **Build → Realtime Database → Create database**.
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
5. Put it in [`src/online/config.js`](../src/online/config.js) in place of `null`, or paste it
   to Claude to do. These values are safe to publish: they only name the project. The database
   rules are what protect it.

## 5. Allow your site's address

1. **Build → Authentication → Settings → Authorized domains → Add domain**.
2. Add `evmsmith-dev.github.io`.

Push the change. Once GitHub Pages has deployed it, **Play online** works.

## Good to know

- **Cost:** the Spark plan never bills. If it's full (100 connections at once), more players get
  "Couldn't connect" until someone leaves.
- **Clean-up:** games are deleted 7 days after they're created. The app tidies old ones whenever
  someone opens online play.
- **Changing the rules later:** paste the new `database.rules.json` into the **Rules** tab again.
- **Trust:** both phones check every move with the same rules engine, so a tampered app can't
  play an illegal move. A game result is trusted from the players' phones, which is fine for
  games between friends but not for prizes or rankings.
