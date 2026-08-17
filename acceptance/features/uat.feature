@daily @uat @web
Feature: Daily acceptance of Neko YouTube Playlist View Count Tracker
  The daily laptop verifies input safety, cancellation, deterministic rendering,
  CSV export, and one credential-backed YouTube request.

  Background:
    Given I open the web application at path "/"
    Then the web page title contains "Playlist"

  Scenario: Validate playlist input before making a request
    Then CSS "#status" contains text "Enter a playlist and API key."
    And CSS "#cancel" is disabled
    And CSS "#export" is disabled
    When I replace CSS "#playlist" with "not a playlist"
    And I click CSS "#load"
    Then CSS "#status" contains text "Enter a valid playlist URL or ID."
    When I replace CSS "#playlist" with "PL1234567890abc"
    And I click CSS "#load"
    Then CSS "#status" contains text "Enter a YouTube Data API key."
    And JavaScript expression "NekoPlaylist.parsePlaylistId('https://www.youtube.com/playlist?list=PL1234567890abc') === 'PL1234567890abc'" returns true
    And JavaScript expression "localStorage.length === 0" returns true

  Scenario: Cancel an in-progress playlist request
    When I execute JavaScript:
      """
      window.fetch = (url, options = {}) => new Promise((resolve, reject) => {
        const signal = options.signal;
        if (signal) signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
      """
    And I replace CSS "#playlist" with "PL1234567890abc"
    And I replace CSS "#apiKey" with "local-test-key"
    And I click CSS "#load"
    Then CSS "#cancel" is enabled
    When I click CSS "#cancel"
    Then CSS "#status" eventually contains text "Request cancelled."
    And CSS "#load" is enabled
    And CSS "#cancel" is disabled
    And CSS "#export" is disabled

  Scenario: Render paginated playlist data including an unavailable video
    When I remember the pixel checksum of CSS canvas "#chart"
    And I execute JavaScript:
      """
      window.fetch = async (request, options = {}) => {
        if (options.signal && options.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const url = new URL(String(request));
        const json = (body) => new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        if (url.pathname.endsWith('/playlistItems')) {
          if (url.searchParams.get('pageToken') === 'page-two') {
            return json({ items: [{
              contentDetails: { videoId: 'video-two', videoPublishedAt: '2026-02-02T00:00:00Z' },
              snippet: { title: 'Unavailable fixture' }
            }] });
          }
          return json({
            nextPageToken: 'page-two',
            items: [{
              contentDetails: { videoId: 'video-one', videoPublishedAt: '2026-01-01T00:00:00Z' },
              snippet: { title: 'Available fixture' }
            }]
          });
        }
        if (url.pathname.endsWith('/videos')) {
          return json({ items: [{
            id: 'video-one',
            snippet: { title: 'Available fixture', publishedAt: '2026-01-01T00:00:00Z' },
            statistics: { viewCount: '1234' },
            status: { privacyStatus: 'public' }
          }] });
        }
        return new Response('{}', { status: 404 });
      };
      """
    And I replace CSS "#playlist" with "PL1234567890abc"
    And I replace CSS "#apiKey" with "local-test-key"
    And I click CSS "#load"
    Then CSS "#status" eventually contains text "Loaded 2 playlist entries."
    And CSS "#videoCount" contains text "2"
    And CSS "#totalViews" contains text "1,234"
    And CSS "#averageViews" contains text "1,234"
    And CSS "#unavailableCount" contains text "1"
    And exactly 2 elements match CSS "#rows tr"
    And CSS "#rows" contains text "Available fixture"
    And CSS "#rows" contains text "Unavailable fixture"
    And the pixel checksum of CSS canvas "#chart" is different
    And CSS "#export" is enabled
    When I click CSS "#export"
    Then a downloaded file matching "playlist-views*.csv" appears
    And JavaScript expression "localStorage.length === 0" returns true

  @requires-youtube-api
  Scenario: Load a live YouTube playlist with the configured credentials
    When I replace CSS "#playlist" with environment variable "NEKO_YOUTUBE_PLAYLIST"
    And I replace CSS "#apiKey" with environment variable "NEKO_YOUTUBE_API_KEY"
    And I click CSS "#load"
    Then CSS "#status" eventually contains text "Loaded "
    And the numeric text in CSS "#videoCount" is greater than 0
    And at least 1 elements match CSS "#rows tr"
    And CSS "#export" is enabled
    And JavaScript expression "localStorage.length === 0" returns true
