# Deploy a private campaign for free

GitHub Pages serves the public application; Firebase Spark stores campaign data. These are separate access boundaries. Do not put character backups or invitation keys in the public repository.

## 1. Create the repository

Create an empty **public** repository on GitHub. Connect this working directory using GitHub Desktop or Git:

```sh
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git add .
git commit -m "Build DnDev campaign sheets"
git push -u origin HEAD
```

Use your actual repository URL. If `git remote -v` already shows the intended `origin`, skip `git remote add` and keep that existing connection. Check the staged files before committing. `.gitignore` excludes local configuration, caches, test evidence, and the supplied PDF. No remote repository was created automatically by this implementation.

Set the repository's default branch to the branch you pushed. The workflow detects it; it does not assume `main` or `master`.

## 2. Create Firebase Spark

1. Open [Firebase Console](https://console.firebase.google.com/), choose **Create a project**, and choose a project name.
2. Keep the **Spark** plan. Do **not** link a Cloud Billing account or upgrade to Blaze. Analytics is unnecessary; leave it disabled for this application.
3. In **Project settings → General**, register a **Web app**. Firebase Hosting is unnecessary.
4. Copy the web configuration's `apiKey`, `authDomain`, `projectId`, and `appId`.
5. In **Build → Authentication → Sign-in method**, enable **Anonymous**.
6. In Authentication settings, add your Pages hostname, `YOUR_ACCOUNT.github.io`, to authorized domains. For development, add `localhost` and `127.0.0.1` if absent.
7. In **Build → Firestore Database**, create the **(default)** database using **Standard edition**, in a location near your players. Use production/locked mode initially.
8. In **Firestore → Rules**, replace the initial rules with [firestore.rules](../firestore.rules) and publish.

No Cloud Functions, Cloud Storage bucket, managed database backups, point-in-time recovery, or paid Firebase extension is needed. Do not enable them as part of this setup.

Spark requires no payment method. Its quotas are finite, and terms may change over a multi-year campaign. [Firebase pricing](https://firebase.google.com/pricing)

## 3. Create the private campaign

Run locally:

```sh
pnpm campaign:key
```

This uses a cryptographic random generator to produce **32 bytes / 256 bits**, printed as 64 lowercase hexadecimal characters. Keep this output private. Never use a predictable key or a value from an emulator test.

In Firestore's **Data** tab:

1. Create a collection named `campaigns`.
2. Set the new document ID to the generated key.
3. Add `name` as a **string**, such as your campaign title.
4. Add `enabled` as a **boolean** with value `true`.

Only these two fields are needed. Do not create character documents manually. The app creates them after anonymous authentication and invitation validation.

The invitation format is:

```text
https://YOUR_ACCOUNT.github.io/YOUR_REPOSITORY/#/join/YOUR_PRIVATE_KEY
```

For a user-site repository named `YOUR_ACCOUNT.github.io`, omit `/YOUR_REPOSITORY`. The fragment is consumed into local browser storage and removed from the displayed URL. Keep a copy of the invitation in a private password manager or private campaign channel.

Possessing the link grants access to **all** campaign characters. There is no separate DM role or per-player ownership. The database rules deny campaign listing and all client-side campaign administration.

## 4. Add public browser configuration

In GitHub, open **Settings → Secrets and variables → Actions → Variables**. Add these **repository variables**, exactly:

| Variable                    | Firebase web configuration value |
| --------------------------- | -------------------------------- |
| `VITE_FIREBASE_API_KEY`     | `apiKey`                         |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain`                     |
| `VITE_FIREBASE_PROJECT_ID`  | `projectId`                      |
| `VITE_FIREBASE_APP_ID`      | `appId`                          |

These values are **public configuration** and are embedded in the JavaScript delivered to every browser. GitHub Secrets would not conceal them in that bundle. Firebase rules and the private invitation protect your data. Keep Firebase's API restrictions intact; HTTP-referrer restrictions can conflict with the application's no-referrer policy. [Firebase API-key guidance](https://firebase.google.com/docs/projects/api-keys)

For local development, copy `.env.example` to `.env.local`, populate the same values, and restart Vite. The file is ignored. Do not store the campaign invitation there.

Never add a Firebase administrator key, service-account JSON, Google Cloud credential, or GitHub personal access token to Vite configuration. The workflow does not need those credentials.

An unconfigured build opens the local example and cannot synchronize a cloud campaign. Adding variables requires a new build.

## 5. Enable GitHub Pages

1. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
2. If your organization restricts Actions, permit the GitHub-owned actions and `pnpm/action-setup` used in the workflow.
3. Push to the default branch, or run **Verify and deploy DnDev** manually.
4. The verification job runs type checks, unit tests, catalog validation, emulator security tests, desktop/mobile browser journeys, and production builds.
5. A successful default-branch run uploads only `dist` and deploys it with the GitHub Pages artifact workflow. Pull requests and non-default branches are verified without deployment.
6. Open the deployment URL, then use your private invitation.

The workflow automatically chooses `/REPOSITORY/` or `/` for a user site. For a custom domain, add repository variable `BASE_PATH=/` and configure the domain in Pages. Domain registration is optional and is outside the zero-cost setup.

GitHub Pages is free for public repositories, and standard public-repository Actions runners are free. The application uses neither self-hosted runners nor a paid GitHub plan. [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 6. Verify with two devices

1. Open the invitation on two devices; there should be no login screen.
2. Create a disposable character on device A. Wait for **All changes synced**.
3. Return to the campaign roster on B, select it, and change gold. Confirm A receives it while the sheet is open.
4. Change different fields on both devices; both changes should remain.
5. Turn one device offline, edit notes, and reload after the status confirms the changes are saved locally. Reconnect and confirm synchronization.
6. Make competing edits to the same field from two temporarily disconnected devices. Reconnect and use the conflict dialog to choose the retained value.
7. Use **Save now**, export a backup, and re-import it. The import preview must create a new character.
8. Archive the disposable sheets after testing.

Cloud delivery at the exact instant a page closes is best effort. Wait for the synced status before switching devices when possible. The local draft queue retries interrupted or rejected writes when reopened.

## Backups and invitation replacement

Export the campaign after a session or before major changes. Keep several dated copies outside the browser and outside the public repository. Browser history is bounded to 20 local checkpoints per character and is not a remote backup service.

To replace a leaked invitation:

1. Ask players to finish syncing, then export the complete campaign and verify the backup contains the expected characters and images.
2. In Console set the old campaign's `enabled` to `false`.
3. Generate a fresh random key and create a new enabled campaign document.
4. Join the new invitation and import the backup. Import creates new character and image IDs.
5. Verify on two devices and share the new invitation privately.

Disabling a campaign blocks future cloud access; it cannot erase copies already stored on someone's device. Local pending edits in the old campaign should be exported separately and reviewed before migration.

## Troubleshooting

| Symptom                           | Check                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| “No Firebase configuration”       | All four repository variables are set; rerun the deployment.                                                           |
| Permission denied                 | Correct key, campaign document exists, `enabled` is a boolean true, rules are published, anonymous auth is enabled.    |
| Save pending / resource exhausted | Check Firestore Usage. Spark blocks operations at quota; drafts remain local. Wait for quota reset and use Save now.   |
| One device shows old data         | Reopen the roster, select the character, check pending/error/conflict status, and verify both use the same invitation. |
| New app available                 | Apply the update prompt after local writes finish. IndexedDB drafts are retained.                                      |
| Blank assets / broken subpath     | Verify Pages source is Actions and `BASE_PATH` matches the deployed path.                                              |
| An old schema cannot be imported  | Keep the original backup; do not edit away version markers. Use a compatible release or an explicit migration.         |
| Incomplete image export           | Reconnect so referenced image documents can be downloaded, then export again.                                          |

Firestore's free allowance currently includes 1 GiB storage, 50,000 reads/day, 20,000 writes/day, and 10 GiB/month outbound transfer. Reads for rule lookups and transactions also count. Disable automatic indexes for `characters` and `assets` fields using collection-group wildcard exemptions if needed; [firestore.indexes.json](../firestore.indexes.json) contains the equivalent configuration. No application query uses field indexes. Applying index configuration via Firebase CLI requires the project owner's interactive login; it is not part of the Pages workflow. [Firestore pricing](https://firebase.google.com/docs/firestore/pricing)
