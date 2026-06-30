(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const state = { records: [], controller: null };

  function parsePlaylistId(value) {
    const text = value.trim();
    if (/^[A-Za-z0-9_-]{10,}$/.test(text)) return text;
    try {
      const url = new URL(text);
      const id = url.searchParams.get("list");
      if (id && /^[A-Za-z0-9_-]{10,}$/.test(id)) return id;
    } catch (_) {}
    throw new Error("Enter a valid playlist URL or ID.");
  }

  async function api(path, params, key, signal) {
    const url = new URL("https://www.googleapis.com/youtube/v3/" + path);
    Object.entries({ ...params, key }).forEach(([name, value]) => url.searchParams.set(name, value));
    const response = await fetch(url, { signal, referrerPolicy: "no-referrer" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "YouTube API request failed.");
    return body;
  }

  async function getPlaylistItems(playlistId, key, signal, progress) {
    const items = [];
    let pageToken = "";
    do {
      const body = await api("playlistItems", { part: "snippet,contentDetails,status", maxResults: "50", playlistId, ...(pageToken ? { pageToken } : {}) }, key, signal);
      items.push(...body.items);
      pageToken = body.nextPageToken || "";
      progress("Loaded " + items.length + " playlist entries...");
    } while (pageToken);
    return items;
  }

  async function getVideoDetails(ids, key, signal, progress) {
    const details = new Map();
    for (let offset = 0; offset < ids.length; offset += 50) {
      const batch = ids.slice(offset, offset + 50);
      const body = await api("videos", { part: "snippet,statistics,status", id: batch.join(","), maxResults: "50" }, key, signal);
      body.items.forEach((item) => details.set(item.id, item));
      progress("Loaded statistics for " + Math.min(offset + 50, ids.length) + " of " + ids.length + " videos...");
    }
    return details;
  }

  function combine(items, details) {
    return items.map((item, index) => {
      const id = item.contentDetails?.videoId;
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
  function render(records) {
    state.records = records;
    const available = records.filter((record) => record.views !== null);
    const total = available.reduce((sum, record) => sum + record.views, 0n);
    byId("videoCount").textContent = format(records.length);
    byId("totalViews").textContent = format(total);
    byId("averageViews").textContent = available.length ? format(total / BigInt(available.length)) : "0";
    byId("unavailableCount").textContent = format(records.length - available.length);
    byId("tableCount").textContent = records.length + " rows";
    const body = byId("rows");
    body.replaceChildren();
    records.forEach((record) => {
      const row = document.createElement("tr");
      const title = document.createElement("div"); title.className = "video";
      if (record.thumbnail) { const image = new Image(); image.src = record.thumbnail; image.alt = ""; image.loading = "lazy"; title.appendChild(image); }
      title.appendChild(Object.assign(document.createElement("span"), { textContent: record.title }));
      const cells = [record.position, title, record.published ? record.published.slice(0, 10) : "-", record.views === null ? "-" : format(record.views)];
      cells.forEach((value) => { const cell = document.createElement("td"); typeof value === "string" || typeof value === "number" ? cell.textContent = value : cell.appendChild(value); row.appendChild(cell); });
      const statusCell = document.createElement("td"); const badge = document.createElement("span"); badge.className = "badge" + (record.status === "unavailable" ? " missing" : ""); badge.textContent = record.status; statusCell.appendChild(badge); row.appendChild(statusCell);
      body.appendChild(row);
    });
    drawChart(records);
    byId("export").disabled = !records.length;
  }

  function drawChart(records) {
    const canvas = byId("chart");
    const ratio = devicePixelRatio || 1;
    const width = Math.max(320, canvas.clientWidth); const height = canvas.clientHeight;
    canvas.width = width * ratio; canvas.height = height * ratio;
    const context = canvas.getContext("2d"); context.scale(ratio, ratio); context.clearRect(0, 0, width, height);
    const top = records.filter((record) => record.views !== null).sort((a, b) => a.views > b.views ? -1 : 1).slice(0, 10);
    if (!top.length) { context.fillStyle = "#5f6d68"; context.font = "14px system-ui"; context.fillText("Load a playlist to draw the chart.", 20, 34); return; }
    const max = Math.log10(Number(top[0].views) + 1); const left = Math.min(220, width * .35); const rowHeight = (height - 28) / top.length;
    context.font = "12px system-ui";
    top.forEach((record, index) => {
      const y = 12 + index * rowHeight; const label = record.title.length > 28 ? record.title.slice(0, 27) + "..." : record.title;
      context.fillStyle = "#34433e"; context.fillText(label, 12, y + rowHeight * .63, left - 20);
      const barWidth = (width - left - 70) * (Math.log10(Number(record.views) + 1) / max);
      context.fillStyle = index === 0 ? "#edb83f" : "#08775b"; context.fillRect(left, y + 4, Math.max(2, barWidth), Math.max(8, rowHeight - 9));
      context.fillStyle = "#17211f"; context.fillText(format(record.views), Math.min(width - 62, left + barWidth + 7), y + rowHeight * .63);
    });
  }

  function csvCell(value) { return '"' + String(value).replaceAll('"', '""') + '"'; }
  function exportCsv() {
    const rows = [["position", "video_id", "title", "published", "views", "status"], ...state.records.map((record) => [record.position, record.id, record.title, record.published, record.views ?? "", record.status])];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "playlist-views.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  async function load() {
    const status = byId("status");
    try {
      const playlistId = parsePlaylistId(byId("playlist").value); const key = byId("apiKey").value.trim();
      if (!key) throw new Error("Enter a YouTube Data API key.");
      state.controller = new AbortController(); byId("load").disabled = true; byId("cancel").disabled = false; status.className = "status";
      const progress = (message) => status.textContent = message;
      const items = await getPlaylistItems(playlistId, key, state.controller.signal, progress);
      const details = await getVideoDetails([...new Set(items.map((item) => item.contentDetails?.videoId).filter(Boolean))], key, state.controller.signal, progress);
      render(combine(items, details)); status.textContent = "Loaded " + items.length + " playlist entries.";
    } catch (error) {
      status.textContent = error.name === "AbortError" ? "Request cancelled." : error.message; status.className = error.name === "AbortError" ? "status" : "status error";
    } finally { state.controller = null; byId("load").disabled = false; byId("cancel").disabled = true; }
  }

  byId("load").addEventListener("click", load); byId("cancel").addEventListener("click", () => state.controller?.abort()); byId("export").addEventListener("click", exportCsv); window.addEventListener("resize", () => drawChart(state.records));
  window.NekoPlaylist = { parsePlaylistId, combine };
  drawChart([]);
})();
