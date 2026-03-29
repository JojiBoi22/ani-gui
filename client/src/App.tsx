import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Play, X, Plus, Check, Loader2, Filter, Tv, Film } from 'lucide-react';
import './App.css';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import Hls from 'hls.js';

const API_BASE = 'http://localhost:3001/api';
const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];

interface Anime {
  _id: string;
  name: string;
  thumbnail: string;
  availableEpisodes: { sub: number; dub: number; };
  genres?: string[];
  status?: string;
}

interface ResolvedSource {
    sourceName: string;
    type: string;
    decodedUrl: string;
    links: { url: string; quality: string; hls: boolean; }[];
}

interface HistoryItem extends Anime {
  lastEpisode: string;
  timestamp: number;
}

function App() {
  const [activeTab, setActiveTab] = useState<'Home' | 'Series' | 'Movies'>('Home');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [episodes, setEpisodes] = useState<string[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  const [sources, setSources] = useState<ResolvedSource[]>([]);
  const [activeSource, setActiveSource] = useState<ResolvedSource | null>(null);
  const [activeLink, setActiveLink] = useState<{ url: string; quality: string; hls: boolean } | null>(null);
  
  const [filterGenre, setFilterGenre] = useState('');
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

  const fetchContent = async () => {
    setLoading(true);
    try {
      let url = "";
      if (activeTab === 'Home' && !query) {
          url = `${API_BASE}/popular?format=TV`; // Default to TV for Home trending
      } else if (query) {
          url = `${API_BASE}/search?query=${query}`;
          if (activeTab === 'Series') url += `&subType=tv`;
          if (activeTab === 'Movies') url += `&subType=movie`;
      } else { // Series or Movies tab with no query
          url = `${API_BASE}/popular?format=${activeTab === 'Movies' ? 'MOVIE' : 'TV'}`;
      }
      
      if (filterGenre) url += `&genres=${filterGenre}`;
      
      const resp = await axios.get(url);
      setResults(resp.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(fetchContent, activeTab === 'Home' && !query ? 0 : 500);
    return () => clearTimeout(debounce);
  }, [activeTab, query, filterGenre]);

  const openAnime = async (anime: Anime) => {
    setSelectedAnime(anime);
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE}/episodes?showId=${anime._id}`);
      setEpisodes(resp.data.availableEpisodesDetail.sub);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisode = async (ep: string) => {
    if (!selectedAnime) return;
    setSelectedEpisode(ep);
    setLoading(true);
    setSources([]);
    setActiveLink(null);
    setActiveSource(null);
    try {
      const resp = await axios.get(`${API_BASE}/stream?showId=${selectedAnime._id}&episode=${ep}`);
      setSources(resp.data);
      const defaultSource = resp.data.find((s: any) => s.links && s.links.length > 0) || resp.data[0];
      setActiveSource(defaultSource);
      if (defaultSource.links && defaultSource.links.length > 0) setActiveLink(defaultSource.links[0]);

      const newHistory = history.filter(h => h._id !== selectedAnime._id);
      newHistory.unshift({ ...selectedAnime, lastEpisode: ep, timestamp: Date.now() });
      setHistory(newHistory.slice(0, 20));
      localStorage.setItem('ani-history', JSON.stringify(newHistory.slice(0, 20)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeLink && videoRef.current) {
        const video = videoRef.current;
        if (activeLink.hls) {
            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(activeLink.url);
                hls.attachMedia(video);
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = activeLink.url;
            }
        } else {
            video.src = activeLink.url;
        }
        if (!plyrRef.current) plyrRef.current = new Plyr(video);
    }
  }, [activeLink]);

  const toggleWatchlist = (e: React.MouseEvent, anime: Anime) => {
    e.stopPropagation();
    const isAdded = watchlist.find(w => w._id === anime._id);
    const newWL = isAdded ? watchlist.filter(w => w._id !== anime._id) : [anime, ...watchlist];
    setWatchlist(newWL);
    localStorage.setItem('ani-watchlist', JSON.stringify(newWL));
  };

  const AnimeCard = ({ anime, vertical = false }: { anime: Anime, vertical?: boolean }) => (
    <div className={`anime-card ${vertical ? 'vertical' : ''}`} onClick={() => openAnime(anime)}>
      <img src={anime.thumbnail} alt={anime.name} loading="lazy" />
      <div className="anime-card-overlay">
        <div className="card-title">{anime.name}</div>
        <div className="card-meta">
          <span>{anime.availableEpisodes.sub} eps</span>
          <span style={{ color: '#46d369' }}>{anime.status || 'Ongoing'}</span>
        </div>
        <button className="close-btn" style={{ position: 'static', width: '30px', height: '30px', marginTop: '0.5rem' }} onClick={(e) => toggleWatchlist(e, anime)}>
            {watchlist.find(w => w._id === anime._id) ? <Check size={16} color="#e50914" /> : <Plus size={16} />}
        </button>
      </div>
    </div>
  );

  const resetView = () => {
    setQuery('');
    setResults([]);
    setSelectedAnime(null);
    setSelectedEpisode(null);
    setActiveLink(null);
    setActiveSource(null);
    setFilterGenre('');
    setActiveTab('Home'); // Reset to Home tab
  };

  return (
    <div className="app-container">
      <header>
        <div className="nav-left">
            <div className="logo" onClick={resetView}>ani-gui</div>
            <ul className="nav-tabs">
                {(['Home', 'Series', 'Movies'] as const).map(tab => (
                    <li key={tab} className={`nav-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => { setActiveTab(tab); setQuery(''); setFilterGenre(''); }}>
                        {tab}
                    </li>
                ))}
            </ul>
        </div>
        <div className="search-container">
          <input
            type="text" className="search-input" placeholder="Search Titles..."
            value={query} onChange={(e) => setQuery(e.target.value)}
          />
          <Search size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
        </div>
      </header>

      {(activeTab !== 'Home' || query) && (
          <div className="filter-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontSize: '0.8rem', fontWeight: 700 }}>
                  <Filter size={14} /> CATEGORIES
              </div>
              <select className="filter-select" value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)}>
                  <option value="">All Genres</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
          </div>
      )}

      <main style={{ paddingBottom: '5rem' }}>
        {activeTab === 'Home' && !query && (
            <>
                {history.length > 0 && (
                    <section>
                        <h2 className="section-title">Recently Watched</h2>
                        <div className="horizontal-scroll">
                            {history.map(anime => (
                                <div key={anime._id} style={{ position: 'relative' }}>
                                    <AnimeCard anime={anime} />
                                    <div className="active-badge">EP {anime.lastEpisode}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {watchlist.length > 0 && (
                    <section>
                        <h2 className="section-title">My List</h2>
                        <div className="horizontal-scroll">
                            {watchlist.map(anime => <AnimeCard key={anime._id} anime={anime} vertical />)}
                        </div>
                    </section>
                )}

                <section>
                    <h2 className="section-title">Trending Today</h2>
                    <div className="grid">
                        {results.length === 0 && !loading ? (
                            <div style={{ color: '#444', gridColumn: '1/-1' }}>Search for an anime or select Series/Movies to browse our catalog.</div>
                        ) : (
                           <div className="grid">
                                {results.map(anime => <AnimeCard key={anime._id} anime={anime} vertical />)}
                           </div>
                        )}
                    </div>
                    {loading && <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 className="animate-spin" /></div>}
                </section>
            </>
        )}

        {(activeTab !== 'Home' || query) && (
            <>
                <section>
                    <h2 className="section-title">{query ? `Search Results for "${query}"` : `Popular ${activeTab}`}</h2>
                    {loading && results.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '5rem' }}><Loader2 className="animate-spin" size={48} /></div>
                    ) : (
                        <div className="grid">
                            {results.map(anime => <AnimeCard key={anime._id} anime={anime} vertical />)}
                        </div>
                    )}
                </section>
            </>
        )}
      </main>

      {selectedAnime && (
        <div className="modal-overlay" onClick={() => { if(!loading) setSelectedAnime(null); setSelectedEpisode(null); setActiveLink(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => { setSelectedAnime(null); setSelectedEpisode(null); setActiveLink(null); }}>
              <X size={20} />
            </button>

            {selectedEpisode ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, background: '#000' }}>
                  {activeLink ? <video ref={videoRef} className="plyr-react plyr" playsInline controls /> : 
                   activeSource?.type === 'iframe' ? <iframe src={activeSource.decodedUrl} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen /> :
                   <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Loader2 className="animate-spin" /></div>}
                </div>
                <div style={{ padding: '1.5rem 3rem', background: '#111' }}>
                    <h3 style={{ margin: 0, color: '#fff' }}>{selectedAnime.name} - Ep {selectedEpisode}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {sources.map(s => <button key={s.sourceName} className="bookmark-btn" onClick={() => setActiveSource(s)} 
                         style={{ background: activeSource?.sourceName === s.sourceName ? 'var(--primary-color)' : '' }}>{s.sourceName}</button>)}
                    </div>
                </div>
              </div>
            ) : (
              <>
                <div className="modal-header-img">
                  <img src={selectedAnime.thumbnail} alt={selectedAnime.name} />
                  <div className="modal-header-overlay">
                    <h1 style={{ margin: '0 0 1rem 0', fontSize: '2.5rem', color: '#fff', fontWeight: 900 }}>{selectedAnime.name}</h1>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button className="primary-btn" onClick={() => loadEpisode(episodes[0] || "1")}><Play fill="black" size={20} /> Play S1:E1</button>
                      <button className="bookmark-btn" onClick={(e) => toggleWatchlist(e, selectedAnime)}>
                         {watchlist.find(w => w._id === selectedAnime._id) ? <Check size={20} color="#e50914" /> : <Plus size={20} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="episode-list-container">
                  <h2 className="section-title" style={{ paddingLeft: 0 }}>Episodes</h2>
                  {episodes.map((ep, idx) => (
                    <div key={ep} className="episode-row" onClick={() => loadEpisode(ep)}>
                      <div className="episode-number">{idx + 1}</div>
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 700, color: '#fff' }}>Episode {ep}</div></div>
                      <Play size={18} fill="#fff" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
