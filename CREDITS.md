# Credits and References

The dashboard implementation is maintained in this repository and has no third-party runtime library.

Its request structure and resource handling follow the official [YouTube Data API v3](https://developers.google.com/youtube/v3) documentation, particularly:

- [`playlistItems.list`](https://developers.google.com/youtube/v3/docs/playlistItems/list) for paginated playlist membership and ordering.
- [`videos.list`](https://developers.google.com/youtube/v3/docs/videos/list) for batched video metadata and statistics.

YouTube names, API responses, and thumbnails remain subject to Google's applicable terms and policies. This project is not affiliated with or endorsed by YouTube or Google.
