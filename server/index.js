const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json());

const ALLANIME_REFR = "https://allmanga.to";
const ALLANIME_BASE = "allanime.day";
const ALLANIME_API = `https://api.${ALLANIME_BASE}/api`;
const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";
const http = axios.create({ timeout: 8000, headers: { Referer: ALLANIME_REFR, "User-Agent": AGENT, "Content-Type": "application/json" } });
const popularCache = new Map();

function decodeSourceUrl(sourceUrl) {
  if (!sourceUrl || !sourceUrl.startsWith("--")) return sourceUrl;
  const hex = sourceUrl.slice(2);
  const map = {"79":"A","7a":"B","7b":"C","7c":"D","7d":"E","7e":"F","7f":"G","70":"H","71":"I","72":"J","73":"K","74":"L","75":"M","76":"N","77":"O","68":"P","69":"Q","6a":"R","6b":"S","6c":"T","6d":"U","6e":"V","6f":"W","60":"X","61":"Y","62":"Z","59":"a","5a":"b","5b":"c","5c":"d","5d":"e","5e":"f","5f":"g","50":"h","51":"i","52":"j","53":"k","54":"l","55":"m","56":"n","57":"o","48":"p","49":"q","4a":"r","4b":"s","4c":"t","4d":"u","4e":"v","4f":"w","40":"x","41":"y","42":"z","08":"0","09":"1","0a":"2","0b":"3","0c":"4","0d":"5","0e":"6","0f":"7","00":"8","01":"9","15":"-","16":".","67":"_","46":"~","02":":","17":"/","07":"?","1b":"#","63":"[","65":"]","78":"@","19":"!","1c":"$","1e":"&","10":"(","11":")","12":"*","13":"+","14":",","03":";","05":"=","1d":"%"};
  let decoded = "";
  for (let i = 0; i < hex.length; i += 2) decoded += map[hex.substr(i, 2)] || "";
  return decoded.replace("/clock", "/clock.json");
}
function normalizeTitle(value) { return String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function titleScore(query, candidate) {
  const q = normalizeTitle(query); const n = normalizeTitle(candidate);
  if (!q || !n) return 0; if (q === n) return 100; if (n.startsWith(q) || q.startsWith(n)) return 86; if (n.includes(q) || q.includes(n)) return 72;
  const qTokens = q.split(" ").filter((word) => word.length > 1); const nTokens = new Set(n.split(" ").filter((word) => word.length > 1));
  if (!qTokens.length) return 0; return Math.round((qTokens.filter((token) => nTokens.has(token)).length / qTokens.length) * 64);
}
function rankShows(edges, query) { return [...edges].sort((a, b) => (titleScore(query, b.name) * 10 + Math.min(Number(b.availableEpisodes?.sub || 0), 400)) - (titleScore(query, a.name) * 10 + Math.min(Number(a.availableEpisodes?.sub || 0), 400))); }
function matchesGenre(show, genre) { if (!genre) return true; const wanted = normalizeTitle(genre); return (show.genres || []).some((item) => normalizeTitle(item) === wanted || normalizeTitle(item).includes(wanted)); }
async function searchShows(name, limit = 12) {
  const searchGql = `query($search: SearchInput, $limit: Int, $translationType: VaildTranslationTypeEnumType, $countryOrigin: VaildCountryOriginEnumType) { shows(search: $search, limit: $limit, translationType: $translationType, countryOrigin: $countryOrigin) { edges { _id name thumbnail availableEpisodes genres status } } }`;
  const response = await http.post(ALLANIME_API, { query: searchGql, variables: { search: { query: name, allowAdult: false, allowUnknown: false }, limit, translationType: "sub", countryOrigin: "ALL" } });
  if (response.data.errors) { const error = new Error(response.data.errors[0].message); error.publicMessage = response.data.errors[0].message; throw error; }
  return response.data.data?.shows?.edges || [];
}
async function mapPool(items, limit, worker) { const results = new Array(items.length); let cursor = 0; async function run() { while (cursor < items.length) { const index = cursor++; results[index] = await worker(items[index], index); } } await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run)); return results; }
app.get("/api/search", async (req, res) => {
  const query = String(req.query.query || "").trim(); const genre = String(req.query.genres || req.query.genre || "").trim(); const subType = String(req.query.subType || "").toLowerCase();
  try { const seed = query || (subType === "movie" ? "movie" : genre || "anime"); let ranked = query ? rankShows(await searchShows(seed, 40), query) : await searchShows(seed, 40); if (genre) ranked = ranked.filter((show) => matchesGenre(show, genre)); if (subType === "movie") ranked = ranked.filter((show) => Number(show.availableEpisodes?.sub || 0) <= 3 || /movie|film/i.test(show.name)); res.json(ranked.slice(0, 40)); } catch (error) { res.status(502).json({ error: error.publicMessage || "Search failed" }); }
});
app.get("/api/episodes", async (req, res) => { const { showId } = req.query; const episodesGql = `query ($showId: String!) { show(_id: $showId) { _id name availableEpisodesDetail } }`; try { const response = await http.post(ALLANIME_API, { query: episodesGql, variables: { showId } }); res.json(response.data.data?.show || { availableEpisodesDetail: { sub: [] } }); } catch (error) { res.status(502).json({ error: "Episode list failed" }); } });
app.get("/api/stream", async (req, res) => {
  const { showId, episode } = req.query; if (!showId || !episode) return res.json([]);
  const streamGql = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) { episode(showId: $showId, translationType: $translationType, episodeString: $episodeString) { episodeString sourceUrls } }`;
  try {
    const response = await http.post(ALLANIME_API, { query: streamGql, variables: { showId, translationType: "sub", episodeString: String(episode) } }, { timeout: 8000 });
    const sourceUrls = response.data.data?.episode?.sourceUrls || [];
    const resolved = await Promise.all(sourceUrls.slice(0, 3).map(async (source) => {
      const decoded = decodeSourceUrl(source.sourceUrl); let links = [];
      if (decoded && decoded.includes("clock.json")) { try { const clockUrl = decoded.startsWith("http") ? decoded : `https://${ALLANIME_BASE}${decoded}`; const clockResp = await http.get(clockUrl, { timeout: 6000 }); links = (clockResp.data.links || []).map((link) => ({ url: link.link, quality: link.resolutionStr, hls: Boolean(link.hls) })); } catch (error) { links = []; } }
      return { ...source, decodedUrl: decoded, links };
    }));
    res.json(resolved);
  } catch (error) { res.json([]); }
});
app.get("/api/popular", async (req, res) => {
  const format = req.query.format ? String(req.query.format) : ""; const genre = String(req.query.genres || req.query.genre || "").trim(); const cacheKey = `${format}|${genre}`; const cached = popularCache.get(cacheKey); if (cached && Date.now() - cached.at < 300000) return res.json(cached.data);
  const anilistGql = `query ($type: MediaType, $format: [MediaFormat]) { Page(page: 1, perPage: 12) { media(type: $type, format_in: $format, sort: TRENDING_DESC) { title { romaji english } coverImage { large } genres } } }`;
  try {
    const response = await axios.post("https://graphql.anilist.co", { query: anilistGql, variables: { type: "ANIME", format: format ? [format] : ["TV", "MOVIE"] } }, { timeout: 8000 });
    const trending = response.data.data?.Page?.media || [];
    const mapped = await mapPool(trending, 4, async (item) => {
      const english = item.title?.english; const romaji = item.title?.romaji; const queries = [...new Set([english, romaji].filter(Boolean))]; let candidates = [];
      for (const name of queries) { try { candidates = candidates.concat(await searchShows(name, 6)); } catch (error) { candidates = candidates; } }
      const best = rankShows(candidates, queries[0] || "").find((show) => titleScore(queries[0] || "", show.name) >= 55); if (!best) return null;
      return { ...best, name: english || romaji || best.name, thumbnail: item.coverImage?.large || best.thumbnail, genres: best.genres || item.genres || [] };
    });
    let results = mapped.filter(Boolean); const seen = new Set(); results = results.filter((show) => (seen.has(show._id) ? false : seen.add(show._id))); if (genre) results = results.filter((show) => matchesGenre(show, genre));
    popularCache.set(cacheKey, { at: Date.now(), data: results }); res.json(results);
  } catch (error) { res.status(502).json({ error: "Popular list failed" }); }
});
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.listen(PORT, "0.0.0.0");
