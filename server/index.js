const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const ALLANIME_REFR = "https://allmanga.to";
const ALLANIME_BASE = "allanime.day";
const ALLANIME_API = `https://api.${ALLANIME_BASE}/api`;
const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";

// Decoding logic ported from ani-cli
function decodeSourceUrl(sourceUrl) {
    if (!sourceUrl.startsWith('--')) return sourceUrl;
    
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

app.get('/api/search', async (req, res) => {
    const { query, subType, genres } = req.query;
    console.log(`Search request for: ${query}, subType: ${subType}, genres: ${genres}`);
    
    const searchGql = `query($search: SearchInput, $limit: Int, $page: Int, $translationType: VaildTranslationTypeEnumType, $countryOrigin: VaildCountryOriginEnumType) { shows(search: $search, limit: $limit, page: $page, translationType: $translationType, countryOrigin: $countryOrigin) { edges { _id name thumbnail availableEpisodes genres status aniListId } } }`;
    
    const variables = {
        search: { 
            allowAdult: false, 
            allowUnknown: false, 
            query: query || "",
            subType: subType || null, // Add subType here
            genres: genres ? (Array.isArray(genres) ? genres : [genres]) : null // Add genres
        },
        limit: 40,
        page: 1,
        translationType: "sub",
        countryOrigin: "ALL"
    };

    if (subType) variables.search.subType = subType;
    if (genres) {
        // Handle both single string and array of genres
        variables.search.genres = Array.isArray(genres) ? genres : [genres];
    }
    
    try {
        const response = await axios.get(ALLANIME_API, {
            params: {
                variables: JSON.stringify(variables),
                query: searchGql
            },
            headers: { 'Referer': ALLANIME_REFR, 'User-Agent': AGENT }
        });
        
        if (response.data.errors) {
            console.error("GraphQL Errors:", response.data.errors);
            return res.status(400).json({ error: response.data.errors[0].message });
        }
        
        const edges = response.data.data.shows.edges;
        console.log(`Found ${edges.length} results`);
        res.json(edges);
    } catch (error) {
        console.error(`Search error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/episodes', async (req, res) => {
    const { showId } = req.query;
    console.log(`Episodes request for showId: ${showId}`);
    const episodesGql = `query ($showId: String!) { show(_id: $showId) { _id name availableEpisodesDetail } }`;
    
    try {
        const response = await axios.get(ALLANIME_API, {
            params: {
                variables: JSON.stringify({ showId }),
                query: episodesGql
            },
            headers: { 'Referer': ALLANIME_REFR, 'User-Agent': AGENT }
        });
        res.json(response.data.data.show);
    } catch (error) {
        console.error(`Episodes error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/stream', async (req, res) => {
    const { showId, episode } = req.query;
    console.log(`Stream request for showId: ${showId}, episode: ${episode}`);
    const streamGql = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) { episode(showId: $showId, translationType: $translationType, episodeString: $episodeString) { episodeString sourceUrls } }`;
    
    try {
        const response = await axios.get(ALLANIME_API, {
            params: {
                variables: JSON.stringify({ showId, translationType: "sub", episodeString: episode }),
                query: streamGql
            },
            headers: { 'Referer': ALLANIME_REFR, 'User-Agent': AGENT }
        });
        
        const sourceUrls = response.data.data.episode.sourceUrls;
        const resolvedSources = await Promise.all(sourceUrls.map(async (s) => {
            const decoded = decodeSourceUrl(s.sourceUrl);
            let finalLinks = [];
            
            if (decoded.includes('clock.json')) {
                try {
                    const clockUrl = decoded.startsWith('http') ? decoded : `https://${ALLANIME_BASE}${decoded}`;
                    const clockResp = await axios.get(clockUrl, {
                        headers: { 'Referer': ALLANIME_REFR, 'User-Agent': AGENT }
                    });
                    // allanime clock.json usually returns { links: [{ link: "...", resolutionStr: "..." }] }
                    if (clockResp.data.links) {
                        finalLinks = clockResp.data.links.map(l => ({
                            url: l.link,
                            quality: l.resolutionStr,
                            hls: l.hls
                        }));
                    }
                } catch (e) {
                    console.error(`Clock resolve error for ${s.sourceName}: ${e.message}`);
                }
            }
            
            return {
                ...s,
                decodedUrl: decoded,
                links: finalLinks
            };
        }));
        
        res.json(resolvedSources);
    } catch (error) {
        console.error(`Stream error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/popular', async (req, res) => {
    const { type, format } = req.query; // type: ANIME, format: MOVIE or TV
    console.log(`Popular request: type=${type}, format=${format}`);
    const anilistGql = `
    query ($type: MediaType, $format: [MediaFormat]) {
      Page (page: 1, perPage: 20) {
        media (type: $type, format_in: $format, sort: TRENDING_DESC) {
          title { romaji english }
          coverImage { large }
          format
        }
      }
    }
    `;

    try {
        console.log("Fetching from AniList...");
        const response = await axios.post('https://graphql.anilist.co', {
            query: anilistGql,
            variables: { type: "ANIME", format: format ? [format] : ["TV", "MOVIE"] }
        });
        
        if (response.data.errors) {
            console.error("AniList GraphQL Errors:", response.data.errors);
            return res.status(400).json({ error: "AniList API error", details: response.data.errors });
        }

        const trending = response.data.data.Page.media;
        console.log(`Fetched ${trending.length} trending items from AniList.`);
        
        if (!trending || trending.length === 0) {
            return res.json([]); // Return empty if no trending items found
        }

        console.log("Searching trending items on AllAnime...");
        const results = await Promise.all(trending.map(async (item) => {
            const name = item.title.english || item.title.romaji;
            const searchGql = `query($search: SearchInput) { shows(search: $search, limit: 1) { edges { _id name thumbnail availableEpisodes } } }`;
            try {
                const aResp = await axios.get(ALLANIME_API, {
                    params: {
                        variables: JSON.stringify({
                            search: { query: name },
                            limit: 1,
                            translationType: "sub"
                        }),
                        query: searchGql
                    },
                    headers: { 'Referer': ALLANIME_REFR, 'User-Agent': AGENT }
                });
                if (aResp.data.data && aResp.data.data.shows && aResp.data.data.shows.edges && aResp.data.data.shows.edges.length > 0) {
                    return aResp.data.data.shows.edges[0];
                }
                return null; // Return null if no match found on AllAnime
            } catch (e) { 
                console.error(`AllAnime search failed for ${name}: ${e.message}`);
                return null; 
            }
        }));

        console.log(`Processed ${results.filter(r => r !== null).length} trending items found on AllAnime.`);
        res.json(results.filter(r => r !== null));
    } catch (error) {
        console.error(`Popular endpoint error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
