const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());

const ALLANIME_REFR = "https://allmanga.to";
const ALLANIME_BASE = "allanime.day";
const ALLANIME_API = `https://api.${ALLANIME_BASE}/api`;
const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";

function decodeSourceUrl(sourceUrl) {
    if (!sourceUrl || !sourceUrl.startsWith('--')) return sourceUrl;

    const hex = sourceUrl.slice(2);
    let decoded = "";
    const map = {
        '79': 'A', '7a': 'B', '7b': 'C', '7c': 'D', '7d': 'E', '7e': 'F', '7f': 'G', '70': 'H', '71': 'I', '72': 'J', '73': 'K', '74': 'L', '75': 'M', '76': 'N', '77': 'O', '68': 'P', '69': 'Q', '6a': 'R', '6b': 'S', '6c': 'T', '6d': 'U', '6e': 'V', '6f': 'W', '60': 'X', '61': 'Y', '62': 'Z',
        '59': 'a', '5a': 'b', '5b': 'c', '5c': 'd', '5d': 'e', '5e': 'f', '5f': 'g', '50': 'h', '51': 'i', '52': 'j', '53': 'k', '54': 'l', '55': 'm', '56': 'n', '57': 'o', '48': 'p', '49': 'q', '4a': 'r', '4b': 's', '4c': 't', '4d': 'u', '4e': 'v', '4f': 'w', '40': 'x', '41': 'y', '42': 'z',
        '08': '0', '09': '1', '0a': '2', '0b': '3', '0c': '4', '0d': '5', '0e': '6', '0f': '7', '00': '8', '01': '9',
        '15': '-', '16': '.', '67': '_', '46': '~', '02': ':', '17': '/', '07': '?', '1b': '#', '63': '[', '65': ']', '78': '@', '19': '!', '1c': '$', '1e': '&', '10': '(', '11': ')', '12': '*', '13': '+', '14': ',', '03': ';', '05': '=', '1d': '%'
    };

    for (let i = 0; i < hex.length; i += 2) {
        const part = hex.substr(i, 2);
        decoded += map[part] || "";
    }
    return decoded.replace("/clock", "/clock.json");
}

function normalizeTitle(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function titleScore(query, candidate) {
    const q = normalizeTitle(query);
    const n = normalizeTitle(candidate);
    if (!q || !n) return 0;
    if (q === n) return 100;
    if (n.startsWith(q) || q.startsWith(n)) return 86;
    if (n.includes(q) || q.includes(n)) return 72;
    const qTokens = q.split(" ").filter((word) => word.length > 1);
    const nTokens = new Set(n.split(" ").filter((word) => word.length > 1));
    if (!qTokens.length) return 0;
    const hits = qTokens.filter((token) => nTokens.has(token)).length;
    return Math.round((hits / qTokens.length) * 64);
}

async function searchShows(name) {
    const searchGql = `query($search: SearchInput, $limit: Int, $translationType: VaildTranslationTypeEnumType, $countryOrigin: VaildCountryOriginEnumType) { shows(search: $search, limit: $limit, translationType: $translationType, countryOrigin: $countryOrigin) { edges { _id name thumbnail availableEpisodes genres status } } }`;
    const response = await axios.post(ALLANIME_API, {
        variables: {
            search: { query: name, allowAdult: false, allowUnknown: false },
            limit: 8,
            translationType: "sub",
            countryOrigin: "ALL"
        },
        query: searchGql
    }, {
        headers: {
            'Referer': ALLANIME_REFR,
            'User-Agent': AGENT,
            'Content-Type': 'application/json'
        }
    });
    return response.data.data?.shows?.edges || [];
}

function pickBestShow(candidates, queries) {
    let best = null;
    let bestRank = -1;
    for (const edge of candidates) {
        const score = Math.max(...queries.map((query) => titleScore(query, edge.name)));
        if (score < 55) continue;
        const episodes = Number(edge.availableEpisodes?.sub || 0);
        const rank = score * 1000 + Math.min(episodes, 400);
        if (rank > bestRank) {
            bestRank = rank;
            best = edge;
        }
    }
    return best;
}

app.get('/api/search', async (req, res) => {
    const { query, subType, genres } = req.query;
    const searchGql = `query($search: SearchInput, $limit: Int, $page: Int, $translationType: VaildTranslationTypeEnumType, $countryOrigin: VaildCountryOriginEnumType) { shows(search: $search, limit: $limit, page: $page, translationType: $translationType, countryOrigin: $countryOrigin) { edges { _id name thumbnail availableEpisodes genres status aniListId } } }`;

    const variables = {
        search: {
            allowAdult: false,
            allowUnknown: false,
            query: query || "",
            subType: subType ? String(subType).toUpperCase() : null
        },
        limit: 40,
        page: 1,
        translationType: "sub",
        countryOrigin: "ALL"
    };

    if (genres) {
        variables.search.genres = Array.isArray(genres) ? genres : [genres];
    }

    try {
        const response = await axios.post(ALLANIME_API, {
            variables,
            query: searchGql
        }, {
            headers: {
                'Referer': ALLANIME_REFR,
                'User-Agent': AGENT,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.errors) {
            return res.status(400).json({ error: response.data.errors[0].message });
        }

        res.json(response.data.data?.shows?.edges || []);
    } catch (error) {
        res.status(500).json({ error: "External API error" });
    }
});

app.get('/api/episodes', async (req, res) => {
    const { showId } = req.query;
    const episodesGql = `query ($showId: String!) { show(_id: $showId) { _id name availableEpisodesDetail } }`;

    try {
        const response = await axios.post(ALLANIME_API, {
            variables: { showId },
            query: episodesGql
        }, {
            headers: {
                'Referer': ALLANIME_REFR,
                'User-Agent': AGENT,
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data.data.show);
    } catch (error) {
        res.status(500).json({ error: "External API error" });
    }
});

app.get('/api/stream', async (req, res) => {
    const { showId, episode } = req.query;
    const streamGql = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) { episode(showId: $showId, translationType: $translationType, episodeString: $episodeString) { episodeString sourceUrls } }`;

    try {
        const response = await axios.post(ALLANIME_API, {
            variables: { showId, translationType: "sub", episodeString: episode },
            query: streamGql
        }, {
            headers: {
                'Referer': ALLANIME_REFR,
                'User-Agent': AGENT,
                'Content-Type': 'application/json'
            }
        });

        const sourceUrls = response.data.data?.episode?.sourceUrls || [];
        const resolvedSources = await Promise.all(sourceUrls.map(async (s) => {
            const decoded = decodeSourceUrl(s.sourceUrl);
            let finalLinks = [];

            if (decoded && decoded.includes('clock.json')) {
                try {
                    const clockUrl = decoded.startsWith('http') ? decoded : `https://${ALLANIME_BASE}${decoded}`;
                    const clockResp = await axios.get(clockUrl, {
                        headers: { 'Referer': ALLANIME_REFR, 'User-Agent': AGENT }
                    });
                    if (clockResp.data.links) {
                        finalLinks = clockResp.data.links.map(l => ({
                            url: l.link,
                            quality: l.resolutionStr,
                            hls: l.hls
                        }));
                    }
                } catch (e) {
                    console.error(`Clock resolve error: ${e.message}`);
                }
            }

            return { ...s, decodedUrl: decoded, links: finalLinks };
        }));

        res.json(resolvedSources);
    } catch (error) {
        res.status(500).json({ error: "External API error" });
    }
});

app.get('/api/popular', async (req, res) => {
    const { format } = req.query;
    const anilistGql = `
    query ($type: MediaType, $format: [MediaFormat]) {
      Page (page: 1, perPage: 16) {
        media (type: $type, format_in: $format, sort: TRENDING_DESC) {
          title { romaji english }
          coverImage { large }
        }
      }
    }
    `;

    try {
        const response = await axios.post('https://graphql.anilist.co', {
            query: anilistGql,
            variables: { type: "ANIME", format: format ? [format] : ["TV", "MOVIE"] }
        });

        const trending = response.data.data?.Page?.media || [];
        const results = [];
        const seen = new Set();

        for (const item of trending) {
            const english = item.title?.english;
            const romaji = item.title?.romaji;
            const queries = [...new Set([english, romaji].filter(Boolean))];
            if (!queries.length) continue;

            let candidates = [];
            for (const query of queries) {
                try {
                    candidates = candidates.concat(await searchShows(query));
                } catch (e) {
                    console.error(`[ERROR] Show search failed for ${query}: ${e.message}`);
                }
            }

            const best = pickBestShow(candidates, queries);
            if (!best || seen.has(best._id)) continue;
            seen.add(best._id);
            results.push({
                ...best,
                name: english || romaji || best.name,
                thumbnail: item.coverImage?.large || best.thumbnail
            });
        }

        res.json(results);
    } catch (error) {
        console.error(`[ERROR] Popular endpoint error: ${error.message}`);
        res.status(500).json({ error: "External API error" });
    }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, '0.0.0.0', (err) => {
    if (err) {
        console.error('[ERROR] Server failed to start:', err);
        return;
    }
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
