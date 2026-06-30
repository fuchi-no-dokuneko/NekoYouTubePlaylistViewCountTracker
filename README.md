# Neko YouTube Playlist View Count Tracker

A static, browser-only dashboard for retrieving all entries in a YouTube playlist, loading current public view counts, and exporting the result as CSV.

## Run

```bash
./serve-local.sh
```

Open `http://localhost:8084`. The app requires a YouTube Data API v3 key. The key is held only in the page's memory and sent directly to `www.googleapis.com`; it is not stored or sent to this project.

## Deploy

The Cloudflare Pages workflow validates the browser smoke test and deploys when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets exist. `CLOUDFLARE_PROJECT_NAME` can override the default project name.
