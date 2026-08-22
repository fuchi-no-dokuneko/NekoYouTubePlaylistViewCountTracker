# Neko YouTube Playlist View Count Tracker

A static, browser-only dashboard for retrieving all entries in a YouTube playlist, loading current public view counts, and exporting the result as CSV.

## Run

```bash
./serve-local.sh
```

Open `http://localhost:8084`. The app requires a YouTube Data API v3 key. The key is held only in the page's memory and sent directly to `www.googleapis.com`; it is not stored or sent to this project. The last playlist value is retained locally for reloads.

Pagination progress is visible and cancellable. Cancellation or a later-page error keeps already received rows only when they are clearly marked partial. CSV output uses UTF-8 and prefixes cells beginning with `=`, `+`, `-`, or `@` so spreadsheet applications treat API-controlled titles as text.

## Deploy

The Cloudflare Pages workflow runs real Chromium HTTP, canvas, storage, pagination, cancellation, and download checks. Deployment is blocked unless line, function, and V8 block-branch coverage are each at least 95 percent. It deploys the exact tested artifact when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets exist. `CLOUDFLARE_PROJECT_NAME` can override the default project name.

## Credits

See [CREDITS.md](CREDITS.md) for YouTube Data API documentation attribution.
