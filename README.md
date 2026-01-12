# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Bestco flyer OCR (optional)

To generate Bestco deals from the flyer page:

1. Copy `.env.example` to `.env` and set `OCR_SPACE_API_KEY`.
2. Run:

```bash
npm run ocr:bestco
```

This writes OCR-parsed deals to `src/fixtures/deals/toronto/bestco.json`.

## AI recipe prompt (optional)

The Plan screen can generate extra recipes from a prompt via a local proxy server.

1. Add `OPENAI_API_KEY` to `.env`.
2. Start the proxy server:

```bash
node server/index.mjs
```

3. Set `EXPO_PUBLIC_AI_BASE_URL` to the server URL (use your machine IP for mobile).

Defaults:
- `OPENAI_MODEL` (default `gpt-4o-mini`)
- `OPENAI_IMAGE_MODEL` (default `gpt-image-1`)

Note: If you switch networks (e.g., to a phone hotspot), update `EXPO_PUBLIC_AI_BASE_URL` in `.env` to your new local IP and restart the server/Expo.

## Local deals scraper (optional)

Run a local background server that refreshes flyer deals hourly (file cache for now).

1. Set `EXPO_PUBLIC_USE_DEALS_PROVIDER=local-scrape`.
2. Start the server:

```bash
node server/deals-scraper.mjs
```

3. Set `EXPO_PUBLIC_DEALS_SERVER_URL` in `.env` if running on a different host/port.

This will write cached results under `server/cache` and refresh automatically once per hour.

Note: If you switch networks, update `EXPO_PUBLIC_DEALS_SERVER_URL` in `.env` to your new local IP and restart the server/Expo.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
