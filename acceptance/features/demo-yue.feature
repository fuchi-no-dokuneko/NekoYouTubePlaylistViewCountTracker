@demo @cantonese @web @requires-youtube-api
Feature: Neko Playlist View Tracker 粵語主要功能示範

  Scenario: 載入播放清單、查看統計及匯出 CSV
    Given I begin a recorded demo
    And I open the web application at path "/"
    When I narrate in "yue-HK" for at least 8 seconds:
      """
      Neko 播放清單瀏覽量工具會直接喺瀏覽器讀取公開嘅 YouTube 播放清單。播放清單編號同已遮蓋嘅 API 金鑰只會留喺呢個分頁，唔會傳去應用程式伺服器。
      """
    And I replace CSS "#playlist" with environment variable "NEKO_YOUTUBE_PLAYLIST"
    And I replace CSS "#apiKey" with environment variable "NEKO_YOUTUBE_API_KEY"
    And I click CSS "#load"
    Then CSS "#status" eventually contains text "Loaded "
    And the numeric text in CSS "#videoCount" is greater than 0
    When I narrate in "yue-HK" for at least 9 seconds:
      """
      載入完成之後，版面會顯示影片數量、總瀏覽量、平均瀏覽量、未能讀取嘅項目、熱門影片圖表，同埋每個播放清單項目嘅資料列。
      """
    Then at least 1 elements match CSS "#rows tr"
    And CSS "#export" is enabled
    When I click CSS "#export"
    Then a downloaded file matching "playlist-views*.csv" appears
    When I narrate in "yue-HK" for at least 6 seconds:
      """
      匯出 CSV 會下載畫面上嘅資料，方便離線分析，而且唔會改動原本嘅播放清單。
      """
    Then I finish the recorded demo
