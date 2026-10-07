import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Check, Clock, Filter, Loader2, Play, Plus, Search, TrendingUp, X } from 'lucide-react';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://server-fawn-tau-57.vercel.app/api';
const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'];
interface Anime { _id: string; name: string; thumbnail: string; availableEpisodes?: { sub?: number }; genres?: string[]; status?: string }
interface StreamLink { url: string; quality: string; hls: boolean }
interface StreamSource { sourceName: string; decodedUrl?: string; links?: StreamLink[] }
interface HistoryItem extends Anime { lastEpisode: string }
const http = axios.create({ timeout: 20000 });

function App() {
  const [activeTab, setActiveTab] = useState<'Home' | 'Trending' | 'Series' | 'Movies' | 'My List'>('Home');
  const [query, setQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [trending, setTrending] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [episodes, setEpisodes] = useState<string[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [activeLink, setActiveLink] = useState<StreamLink | null>(null);
  const [streamError, setStreamError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [watchlist, setWatchlist] = useState<Anime[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const plyrRef = useRef<Plyr | null>(null);
  useEffect(() => {
    const savedHistory = localStorage.getItem('ani-history');
    const savedWatchlist = localStorage.getItem('ani-watchlist');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));
  }, []);
  const fetchContent = useCallback(async () => {
    if (activeTab === 'My List' && !query) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterGenre) params.set('genres', filterGenre);
      let url = `${API_BASE}/popular`;
      if (query) { params.set('query', query); url = `${API_BASE}/search`; }
      else if (activeTab === 'Movies') params.set('format', 'MOVIE');
      else if (activeTab === 'Series') params.set('format', 'TV');
      else if (activeTab === 'Home') params.set('format', 'TV');
      const resp = await http.get(`${url}?${params.toString()}`);
      const data = Array.isArray(resp.data) ? resp.data : [];
      if (activeTab === 'Home' && !query) { setTrending(data.slice(0, 8)); setResults(data); } else setResults(data);
    } catch (error) { console.error(error); setResults([]); } finally { setLoading(false); }
  }, [activeTab, query, filterGenre]);
  useEffect(() => { const timer = setTimeout(fetchContent, query ? 350 : 0); return () => clearTimeout(timer); }, [fetchContent, query]);
  const openAnime = async (anime: Anime) => {
    setSelectedAnime(anime); setSelectedEpisode(null); setActiveLink(null); setStreamError(''); setLoading(true);
    try { const resp = await http.get(`${API_BASE}/episodes?showId=${anime._id}`); const eps = resp.data?.availableEpisodesDetail?.sub; setEpisodes(Array.isArray(eps) ? eps.map((ep: string | number) => String(ep)) : []); }
    catch (error) { console.error(error); setEpisodes([]); } finally { setLoading(false); }
  };
  const loadEpisode = async (ep: string) => {
    if (!selectedAnime) return;
    setSelectedEpisode(ep); setLoading(true); setSources([]); setActiveLink(null); setStreamError('');
    try {
      const resp = await http.get(`${API_BASE}/stream?showId=${selectedAnime._id}&episode=${ep}`);
      const sourcesData: StreamSource[] = Array.isArray(resp.data) ? resp.data : [];
      const playable = sourcesData.find((source) => source.links && source.links.length > 0);
      setSources(sourcesData); setActiveLink(playable?.links?.[0] || null);
      if (!playable) setStreamError('No playable source came back. AllAnime is blocking episode links, so this stops instead of spinning.');
      setHistory((prev) => { const updated = [{ ...selectedAnime, lastEpisode: ep }, ...prev.filter((item) => item._id !== selectedAnime._id)].slice(0, 20); localStorage.setItem('ani-history', JSON.stringify(updated)); return updated; });
    } catch (error) { console.error(error); setStreamError('The stream request timed out. Try another episode.'); } finally { setLoading(false); }
  };
  useEffect(() => {
    if (!activeLink || !videoRef.current) return;
    const video = videoRef.current;
    if (plyrRef.current) plyrRef.current.destroy();
    if (activeLink.hls && Hls.isSupported()) { const hls = new Hls(); hls.loadSource(activeLink.url); hls.attachMedia(video); } else video.src = activeLink.url;
    plyrRef.current = new Plyr(video);
  }, [activeLink]);
  const toggleWatchlist = (event: React.MouseEvent, anime: Anime) => {
    event.stopPropagation();
    const next = watchlist.some((item) => item._id === anime._id) ? watchlist.filter((item) => item._id !== anime._id) : [anime, ...watchlist];
    setWatchlist(next); localStorage.setItem('ani-watchlist', JSON.stringify(next));
  };
  const AnimeCard = ({ anime }: { anime: Anime }) => (
    <div className="anime-card" onClick={() => openAnime(anime)}>
      <img src={anime.thumbnail} alt={anime.name} loading="lazy" />
      <div className="card-copy"><div className="card-title">{anime.name}</div><div className="card-meta"><span>{anime.availableEpisodes?.sub || 0} eps</span><button onClick={(event) => toggleWatchlist(event, anime)}>{watchlist.some((item) => item._id === anime._id) ? <Check size={14} /> : <Plus size={14} />}</button></div></div>
    </div>
  );
  return (
    <div>
      <header>
        <div className="brand" onClick={() => { setQuery(''); setSelectedAnime(null); setActiveTab('Home'); }}>
          <div className="logo">ani-guietsu</div><div className="site-tag">One more episode</div>
          <ul className="nav-tabs">{(['Home', 'Trending', 'Series', 'Movies', 'My List'] as const).map((tab) => <li key={tab} className={`nav-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => { setActiveTab(tab); setQuery(''); }}>{tab}</li>)}</ul>
        </div>
        <div className="search-container"><Search size={16} className="search-icon" /><input className="search-input" placeholder="Search titles..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      </header>
      {activeTab !== 'My List' && <div className="filter-bar"><div className="filter-label"><Filter size={14} /> Categories</div><select className="filter-select" value={filterGenre} onChange={(event) => setFilterGenre(event.target.value)}><option value="">All genres</option>{GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</select></div>}
      <main>
        {activeTab === 'Home' && !query && trending[0] && <section className="hero-section"><div className="hero-background"><img src={trending[0].thumbnail} alt="" /><div className="hero-overlay" /></div><div className="hero-content"><div className="hero-badge">Trending Now</div><h1 className="hero-title">{trending[0].name}</h1><button className="hero-play-btn" onClick={() => openAnime(trending[0])}><Play size={18} /> Watch Now</button></div></section>}
        {activeTab === 'Home' && !query && history.length > 0 && <section><h2 className="section-title"><Clock size={18} /> Recently watched</h2><div className="grid">{history.map((anime) => <AnimeCard key={anime._id} anime={anime} />)}</div></section>}
        {activeTab === 'My List' && !query && <section><h2 className="section-title">My list</h2><div className="grid">{watchlist.map((anime) => <AnimeCard key={anime._id} anime={anime} />)}{watchlist.length === 0 && <p className="empty-message">Your list is empty.</p>}</div></section>}
        {(activeTab !== 'My List' || query) && <section><h2 className="section-title">{query ? `Results for \"${query}\"` : <><TrendingUp size={18} /> {activeTab}</>}</h2>{loading ? <div className="loader-centered"><Loader2 /></div> : <div className="grid">{results.map((anime) => <AnimeCard key={anime._id} anime={anime} />)}{results.length === 0 && <p className="empty-message">Nothing matched that filter.</p>}</div>}</section>}
      </main>
      {selectedAnime && <div className="modal-overlay" onClick={() => setSelectedAnime(null)}><div className="modal-content" onClick={(event) => event.stopPropagation()}><button className="close-modal" onClick={() => setSelectedAnime(null)}><X size={18} /></button>{selectedEpisode ? <div><div className="player-container">{activeLink ? <video ref={videoRef} playsInline controls /> : <div className="player-error">{loading ? 'Looking up sources...' : streamError || 'No source for this episode.'}</div>}</div><div className="player-info"><h3>{selectedAnime.name} \u00b7 Episode {selectedEpisode}</h3></div></div> : <><div className="modal-hero"><img src={selectedAnime.thumbnail} alt={selectedAnime.name} /><div className="modal-hero-overlay"><h1>{selectedAnime.name}</h1><div className="modal-actions"><button className="primary-btn" onClick={() => loadEpisode(episodes[0] || '1')}><Play size={16} /> Watch now</button><button className="secondary-btn" onClick={(event) => toggleWatchlist(event, selectedAnime)}><Plus size={16} /> List</button></div></div></div><div className="episode-section"><h2>Episodes</h2>{episodes.map((ep) => <div key={ep} className="episode-item" onClick={() => loadEpisode(ep)}><Play size={14} /> Episode {ep}</div>)}{episodes.length === 0 && <p className="empty-message">No episode list yet.</p>}</div></>}</div></div>}
    </div>
  );
}
export default App;
