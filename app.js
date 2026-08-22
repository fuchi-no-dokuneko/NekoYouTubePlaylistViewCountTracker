(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const PLAYLIST_STORAGE_KEY = "neko-playlist:last-playlist";
  const state = { records: [], controller: null, partial: false };

  function parsePlaylistId(value) {
    const text = String(value).trim();
    if (/^[A-Za-z0-9_-]{10,}$/.test(text)) return text;
    try {
      const id = new URL(text).searchParams.get("list");
      if (id && /^[A-Za-z0-9_-]{10,}$/.test(id)) return id;
    } catch (_) {
      // The common validation error below is clearer than URL's parser error.
    }
    throw new Error("Enter a valid playlist URL or ID.");
  }

  function apiBase() {
    const requested = new URLSearchParams(location.search).get("apiBase");
    if (!requested) {
      return new URL("https://www.googleapis.com/youtube/v3/");
    }
    const resolved = new URL(requested, location.href);
    if (resolved.origin !== location.origin) {
      throw new Error("A custom API endpoint must use this page's origin.");
    }
    return resolved;
  }

  async function api(path, params, key, signal) {
    const url = new URL(path, apiBase());
    Object.entries({ ...params, key }).forEach(([name, value]) => url.searchParams.set(name, value));
    const response = await fetch(url, { signal, referrerPolicy: "no-referrer" });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (_) {
      const kind = response.ok ? "invalid JSON" : "a non-JSON error";
      throw new Error(`YouTube API returned ${kind} (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      const reason = body.error?.errors?.[0]?.reason || "";
      if (/quota/i.test(reason)) {
        throw new Error(`YouTube API quota exceeded (HTTP ${response.status}). Retry after the quota resets.`);
      }
      throw new Error(`${body.error?.message || "YouTube API request failed"} (HTTP ${response.status}).`);
    }
    return body;
  }

  async function getPlaylistItems(playlistId, key, signal, progress) {
    const items = [];
    let pageToken = "";
    try {
      do {
        const body = await api(
          "playlistItems",
          { part: "snippet,contentDetails,status", maxResults: "50", playlistId, ...(pageToken ? { pageToken } : {}) },
          key,
          signal
        );
        if (!Array.isArray(body.items)) throw new Error("YouTube playlist response has no items array.");
        items.push(...body.items);
        pageToken = body.nextPageToken || "";
        progress(`Loaded ${items.length} playlist entries${pageToken ? "; requesting next page" : ""}...`);
      } while (pageToken);
      return items;
    } catch (error) {
      error.partialItems = items.slice();
      throw error;
    }
  }

  async function getVideoDetails(ids, key, signal, progress) {
    const details = new Map();
    try {
      for (let offset = 0; offset < ids.length; offset += 50) {
        const batch = ids.slice(offset, offset + 50);
        const body = await api(
          "videos",
          { part: "snippet,statistics,status", id: batch.join(","), maxResults: "50" },
          key,
          signal
        );
        if (!Array.isArray(body.items)) throw new Error("YouTube video response has no items array.");
        body.items.forEach((item) => details.set(item.id, item));
        progress(`Loaded statistics for ${Math.min(offset + 50, ids.length)} of ${ids.length} videos...`);
      }
      return details;
    } catch (error) {
      error.partialDetails = details;
      throw error;
    }
  }

  function combine(items, details) {
    return items.map((item, index) => {
      const id = item.contentDetails?.videoId || "";
      const detail = details.get(id);
      return {
        position: index + 1,
        id,
        title: detail?.snippet?.title || item.snippet?.title || "Unavailable video",
        published: detail?.snippet?.publishedAt || item.contentDetails?.videoPublishedAt || "",
        thumbnail: detail?.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.medium?.url || "",
        views: detail?.statistics?.viewCount == null ? null : BigInt(detail.statistics.viewCount),
        status: detail ? (detail.status?.privacyStatus || "public") : "unavailable"
      };
    });
  }

  const format = (value) => BigInt(value).toLocaleString("en-US");

  function render(records, partial = false) {
    state.records = records;
    state.partial = partial;
    const available = records.filter((record) => record.views !== null);
    const total = available.reduce((sum, record) => sum + record.views, 0n);
    byId("videoCount").textContent = format(records.length);
    byId("totalViews").textContent = format(total);
    byId("averageViews").textContent = available.length ? format(total / BigInt(available.length)) : "0";
    byId("unavailableCount").textContent = format(records.length - available.length);
    byId("tableCount").textContent = `${records.length} rows${partial ? " (partial)" : ""}`;
    const body = byId("rows");
    body.replaceChildren();
    records.forEach((record) => {
      const row = document.createElement("tr");
      const title = document.createElement("div");
      title.className = "video";
      if (record.thumbnail) {
        const image = new Image();
        image.src = record.thumbnail;
        image.alt = "";
        image.loading = "lazy";
        title.appendChild(image);
      }
      title.appendChild(Object.assign(document.createElement("span"), { textContent: record.title }));
      const cells = [
        record.position,
        title,
        record.published ? record.published.slice(0, 10) : "-",
        record.views === null ? "-" : format(record.views)
      ];
      cells.forEach((value) => {
        const cell = document.createElement("td");
        if (typeof value === "string" || typeof value === "number") cell.textContent = value;
        else cell.appendChild(value);
        row.appendChild(cell);
      });
      const statusCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `badge${record.status === "unavailable" ? " missing" : ""}`;
      badge.textContent = record.status;
      statusCell.appendChild(badge);
      row.appendChild(statusCell);
      body.appendChild(row);
    });
    drawChart(records);
    byId("export").disabled = !records.length;
  }

  function drawChart(records) {
    const canvas = byId("chart");
    const ratio = Math.max(1, devicePixelRatio);
    const width = Math.max(320, canvas.clientWidth);
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    const top = records
      .filter((record) => record.views !== null)
      .sort((left, right) => left.views > right.views ? -1 : 1)
      .slice(0, 10);
    if (!top.length) {
      context.fillStyle = "#5f6d68";
      context.font = "14px system-ui";
      context.fillText("Load a playlist to draw the chart.", 20, 34);
      return;
    }
    const maximum = Math.max(1, Math.log10(Number(top[0].views) + 1));
    const left = Math.min(220, width * 0.35);
    const rowHeight = (height - 28) / top.length;
    context.font = "12px system-ui";
    top.forEach((record, index) => {
      const y = 12 + index * rowHeight;
      const label = record.title.length > 28 ? `${record.title.slice(0, 27)}...` : record.title;
      context.fillStyle = "#34433e";
      context.fillText(label, 12, y + rowHeight * 0.63, left - 20);
      const barWidth = (width - left - 70) * (Math.log10(Number(record.views) + 1) / maximum);
      context.fillStyle = index === 0 ? "#edb83f" : "#08775b";
      context.fillRect(left, y + 4, Math.max(2, barWidth), Math.max(8, rowHeight - 9));
      context.fillStyle = "#17211f";
      context.fillText(format(record.views), Math.min(width - 62, left + barWidth + 7), y + rowHeight * 0.63);
    });
  }

  function safeSpreadsheetValue(value) {
    const text = String(value ?? "");
    return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  }

  function csvCell(value) {
    return `"${safeSpreadsheetValue(value).replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    const rows = [
      ["position", "video_id", "title", "published", "views", "status"],
      ...state.records.map((record) => [
        record.position,
        record.id,
        record.title,
        record.published,
        record.views ?? "",
        record.status
      ])
    ];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`], {
      type: "text/csv;charset=utf-8"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "playlist-views.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  function setStatus(message, error = false) {
    const status = byId("status");
    status.textContent = message;
    status.className = error ? "status error" : "status";
  }

  async function load() {
    let items = [];
    let details = new Map();
    try {
      const playlistId = parsePlaylistId(byId("playlist").value);
      const key = byId("apiKey").value.trim();
      if (!key) throw new Error("Enter a YouTube Data API key.");
      state.controller = new AbortController();
      byId("load").disabled = true;
      byId("cancel").disabled = false;
      setStatus("Starting YouTube API request...");
      const progress = (message) => setStatus(message);
      items = await getPlaylistItems(playlistId, key, state.controller.signal, progress);
      const ids = [...new Set(items.map((item) => item.contentDetails?.videoId).filter(Boolean))];
      details = await getVideoDetails(ids, key, state.controller.signal, progress);
      render(combine(items, details));
      setStatus(`Loaded ${items.length} playlist entries.`);
    } catch (error) {
      const retainedItems = error.partialItems || items;
      const retainedDetails = error.partialDetails || details;
      if (retainedItems.length) render(combine(retainedItems, retainedDetails), true);
      if (error.name === "AbortError") {
        setStatus(`Request cancelled. Retained ${retainedItems.length} partial entries.`);
      } else {
        const suffix = retainedItems.length ? ` Retained ${retainedItems.length} partial entries; export is marked partial.` : "";
        setStatus(`${error.message}${suffix}`, true);
      }
    } finally {
      state.controller = null;
      byId("load").disabled = false;
      byId("cancel").disabled = true;
    }
  }

  function restorePlaylist() {
    try {
      byId("playlist").value = localStorage.getItem(PLAYLIST_STORAGE_KEY) || "";
    } catch (_) {
      byId("playlist").value = "";
    }
  }

  function rememberPlaylist() {
    try {
      localStorage.setItem(PLAYLIST_STORAGE_KEY, byId("playlist").value);
    } catch (_) {
      // The tracker remains usable when storage is disabled.
    }
  }

  restorePlaylist();
  byId("playlist").addEventListener("change", rememberPlaylist);
  byId("load").addEventListener("click", load);
  byId("cancel").addEventListener("click", () => state.controller?.abort());
  byId("export").addEventListener("click", exportCsv);
  window.addEventListener("resize", () => drawChart(state.records));
  window.NekoPlaylist = {
    api,
    apiBase,
    combine,
    csvCell,
    drawChart,
    getPlaylistItems,
    getVideoDetails,
    load,
    parsePlaylistId,
    render,
    rememberPlaylist,
    restorePlaylist,
    safeSpreadsheetValue,
    state
  };
  drawChart([]);
})();
