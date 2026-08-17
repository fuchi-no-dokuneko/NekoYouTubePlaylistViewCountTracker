@demo @english @web @requires-youtube-api
Feature: English key-feature demonstration of Neko Playlist View Tracker

  Scenario: Load a playlist, inspect totals, and export CSV
    Given I begin a recorded demo
    And I open the web application at path "/"
    When I narrate in "en-US" for at least 8 seconds:
      """
      Neko Playlist View Tracker reads a public YouTube playlist directly in this browser. The playlist identifier and masked API key stay in this tab and are not sent to an application server.
      """
    And I replace CSS "#playlist" with environment variable "NEKO_YOUTUBE_PLAYLIST"
    And I replace CSS "#apiKey" with environment variable "NEKO_YOUTUBE_API_KEY"
    And I click CSS "#load"
    Then CSS "#status" eventually contains text "Loaded "
    And the numeric text in CSS "#videoCount" is greater than 0
    When I narrate in "en-US" for at least 9 seconds:
      """
      After loading finishes, the dashboard shows video count, total and average views, unavailable entries, a chart of leading videos, and one auditable table row for each playlist entry.
      """
    Then at least 1 elements match CSS "#rows tr"
    And CSS "#export" is enabled
    When I click CSS "#export"
    Then a downloaded file matching "playlist-views*.csv" appears
    When I narrate in "en-US" for at least 6 seconds:
      """
      Export CSV downloads the currently displayed rows for offline analysis without changing the playlist.
      """
    Then I finish the recorded demo
