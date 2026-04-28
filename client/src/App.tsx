import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Search, Play, X, Plus, Check, Loader2, Filter, TrendingUp, Clock  from 'lucide-react';
import './App.css';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import Hls from 'hls.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];

// =============================================================================
// Type Definitions
// =============================================================================
interface Anime {
  _id: string;
  name: string;
  thumbnail: string;
  availableEpisodes: { sub: number; dub: number; ;
  genres?: string[];
  status?: string;
  score?: number;


interface ResolvedSource {
  sourceName: string;
  type: string;
  decodedUrl: string;
  links: { url: string; quality: string; hls: boolean; [];


interface HistoryItem extends Anime {
  lastEpisode: string;
  timestamp: number;
  progress?: number;


// =============================================================================
// Hero Section Component
// =============================================================================
const Hero = ({ anime, onPlay : { anime: Anime; onPlay: (anime: Anime) => void ) => {
  if (!anime) return null;
  return (
    <div className="hero-section">
      <div className="hero-background">
        <img src={anime.thumbnail alt="" />
        <div className="hero-overlay"></div>
      </div>
      <div className="hero-content">
        <div className="hero-badge">Trending Now</div>
        <h1 className="hero-title">{anime.name</h1>
        <div className="hero-actions">
          <button className="hero-play-btn" onClick={() => onPlay(anime)>
            <Play fill="currentColor" size={24 /> Watch Now
          </button>
        </div>
      </div>
    </div>
  );
;

// =============================================================================
// Main App Component
// =============================================================================
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
  const [sources, setSources] = useState<ResolvedSource[]>([]);
  const [activeSource, setActiveSource] = useState<ResolvedSource | null>(null);
  const [activeLink, setActiveLink] = useState<{ url: string; quality: string; hls: boolean  | null>(null);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [watchlist, setWatchlist] = useState<Anime[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const plyrRef = useRef<Plyr | null>(null);

  // Load saved data
  useEffect(() => {
    const savedHistory = localStorage.getItem('ani-history');
    const savedWatchlist = localStorage.getItem('ani-watchlist');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));
  , []);

  // Fetch Content
  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      let url = "";
      if (query) {
        url = `${API_BASE/search?query=${encodeURIComponent(query)`;
        if (activeTab === 'Series') url += `&subType=tv`;
        if (activeTab === 'Movies') url += `&subType=movie`;
 else {
        switch(activeTab) {
          case 'Home':
            url = `${API_BASE/popular?format=TV`;
            break;
          case 'Trending':
            url = `${API_BASE/popular`;
            break;
          case 'Series':
            url = `${API_BASE/search?subType=tv`;
            break;
          case 'Movies':
            url = `${API_BASE/search?subType=movie`;
            break;
          default:
            return;
  


      if (filterGenre) url += (url.includes('?') ? '&' : '?') + `genres=${encodeURIComponent(filterGenre)`;
      
      const resp = await axios.get(url);
      const data = Array.isArray(resp.data) ? resp.data : [];
      
      if (activeTab === 'Home' && !query) {
        setTrending(data.slice(0, 10));
        setResults(data.slice(1));
 else {
        setResults(data);

     catch (err) {
      console.error(err);
     finally {
      setLoading(false);
    
  , [activeTab, query, filterGenre]);

  useEffect(() => {
    const debounce = setTimeout(fetchContent, (activeTab === 'Home' || activeTab === 'My List') && !query ? 0 : 500);
    return () => clearTimeout(debounce);
  , [fetchContent, activeTab, query]);

  const openAnime = async (anime: Anime) => {
    setSelectedAnime(anime);
    setSelectedEpisode(null);
    setActiveLink(null);
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE/episodes?showId=${anime._id`);
      const eps = resp.data?.availableEpisodesDetail?.sub;
      setEpisodes(Array.isArray(eps) ? eps.map((e: string | number) => String(e)) : []);
     catch (err) {
      console.error(err);
     finally {
      setLoading(false);
    
  ;

  const openAnime = async (anime: Anime) => {
    setSelectedAnime(anime);
    setSelectedEpisode(null);
    setActiveLink(null);
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE/episodes?showId=${anime._id`);
      const eps = resp.data?.availableEpisodesDetail?.sub;
      setEpisodes(Array.isArray(eps) ? eps.map((e: string | number) => String(e)).reverse() : []);
     catch (err) {
      console.error(err);
     finally {
      setLoading(false);
    

  const loadEpisode = async (ep: string) => {
    if (!selectedAnime) return;
    setSelectedEpisode(ep);
    setLoading(true);
    setSources([]);
    setActiveLink(null);
    try {
      const resp = await axios.get(`${API_BASE/stream?showId=${selectedAnime._id&episode=${ep`);
      const sourcesData: ResolvedSource[] = resp.data;
      setSources(sourcesData);
      const defaultSource = sourcesData.find((s) => s.links && s.links.length > 0) || sourcesData[0];
      setActiveSource(defaultSource);
      if (defaultSource && defaultSource.links && defaultSource.links.length > 0) setActiveLink(defaultSource.links[0]);

      // Update history
      setHistory(prev => {
        const filtered = prev.filter(h => h._id !== selectedAnime._id);
        const updated = [{ ...selectedAnime, lastEpisode: ep, timestamp: Date.now() , ...filtered].slice(0, 20);
        localStorage.setItem('ani-history', JSON.stringify(updated));
        return updated;
);
     catch (err) {
      console.error(err);
     finally {
      setLoading(false);
    
  ;

  const openAnime = async (anime: Anime) => {
    setSelectedAnime(anime);
    setSelectedEpisode(null);
    setActiveLink(null);
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE/episodes?showId=${anime._id`);
      const eps = resp.data?.availableEpisodesDetail?.sub;
      setEpisodes(Array.isArray(eps) ? eps.map((e: string | number) => String(e)).reverse() : []);
     catch (err) {
      console.error(err);
     finally {
      setLoading(false);
    

  useEffect(() => {
    if (activeLink && videoRef.current) {
      const video = videoRef.current;
      
      if (plyrRef.current) {
        plyrRef.current.destroy();
        plyrRef.current = null;


      if (activeLink.hls) {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(activeLink.url);
          hls.attachMedia(video);
   else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = activeLink.url;
  
 else {
        video.src = activeLink.url;

      
      plyrRef.current = new Plyr(video, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen']
);

      const handleTimeUpdate = () => {
        if (video.duration && selectedAnime) {
          const progress = Math.round((video.currentTime / video.duration) * 100);
          if (progress % 5 === 0) { // Update every 5%
            setHistory(prev => {
              const idx = prev.findIndex(h => h._id === selectedAnime._id);
              if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], progress ;
                localStorage.setItem('ani-history', JSON.stringify(updated));
                return updated;
        
              return prev;
      );
    
  
;

      video.addEventListener('timeupdate', handleTimeUpdate);
      return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    
  , [activeLink, selectedAnime]);

  const toggleWatchlist = (e: React.MouseEvent, anime: Anime) => {
    e.stopPropagation();
    const isAdded = watchlist.find(w => w._id === anime._id);
    const newWL = isAdded ? watchlist.filter(w => w._id !== anime._id) : [anime, ...watchlist];
    setWatchlist(newWL);
    localStorage.setItem('ani-watchlist', JSON.stringify(newWL));
  ;

  const AnimeCard = ({ anime, vertical = false : { anime: Anime, vertical?: boolean ) => {
    const historyItem = history.find(h => h._id === anime._id);
    const isInWatchlist = watchlist.find(w => w._id === anime._id);
    
    return (
      <div className={`anime-card ${vertical ? 'vertical' : ''` onClick={() => openAnime(anime)>
        <img src={anime.thumbnail alt={anime.name loading="lazy" />
        {historyItem && historyItem.progress && (
          <div className="card-progress-container">
            <div className="card-progress-bar" style={{ width: `${historyItem.progress%` ></div>
          </div>
        )
        <div className="anime-card-overlay">
          <div className="card-title">{anime.name</div>
          <div className="card-meta">
            <span>{anime.availableEpisodes?.sub || 0 eps</span>
            <span style={{ color: '#46d369' >{anime.status || 'Ongoing'</span>
          </div>
          <button className="add-to-list-btn" onClick={(e) => toggleWatchlist(e, anime)>
            {isInWatchlist ? <Check size={16 color="#7c3aed" /> : <Plus size={16 />
          </button>
        </div>
      </div>
    );
  ;

  const resetView = () => {
    setQuery('');
    setSelectedAnime(null);
    setSelectedEpisode(null);
    setActiveLink(null);
    setActiveTab('Home');
  ;

  return (
    <div className="app-container">
      <header>
        <div className="nav-left">
          <div className="logo" onClick={resetView>ani-gui<sup style={{fontSize: '0.6em', color: '#7c3aed'>etsu</sup></div>
          <ul className="nav-tabs">
            {(['Home', 'Trending', 'Series', 'Movies', 'My List'] as const).map(tab => (
              <li key={tab className={`nav-tab ${activeTab === tab ? 'active' : ''` 
                  onClick={() => { setActiveTab(tab); setQuery(''); setFilterGenre(''); >
                {tab
              </li>
            ))
          </ul>
        </div>
        <div className="search-container">
          <input
            type="text" className="search-input" placeholder="Search titles..."
            value={query onChange={(e) => setQuery(e.target.value)
          />
          <Search size={18 className="search-icon" />
        </div>
      </header>

      {((activeTab !== 'Home' && activeTab !== 'My List') || query) && (
        <div className="filter-bar">
          <div className="filter-label"><Filter size={14 /> CATEGORIES</div>
          <select className="filter-select" value={filterGenre onChange={(e) => setFilterGenre(e.target.value)>
            <option value="">All Genres</option>
            {GENRES.map(g => <option key={g value={g>{g</option>)
          </select>
        </div>
      )

      <main>
        {activeTab === 'Home' && !query && (
          <>
            {trending.length > 0 && <Hero anime={trending[0] onPlay={openAnime />
            
            {history.length > 0 && (
              <section>
                <h2 className="section-title"><Clock size={20 /> Recently Watched</h2>
                <div className="horizontal-scroll">
                  {history.map(anime => (
                    <div key={anime._id style={{ position: 'relative' >
                      <AnimeCard anime={anime />
                      <div className="episode-badge">EP {anime.lastEpisode</div>
                    </div>
                  ))
                </div>
              </section>
            )

            {watchlist.length > 0 && (
              <section>
                <h2 className="section-title"><Check size={20 /> My List</h2>
                <div className="horizontal-scroll">
                  {watchlist.map(anime => <AnimeCard key={anime._id anime={anime vertical />)
                </div>
              </section>
            )

            <section>
              <h2 className="section-title"><TrendingUp size={20 /> Trending Now</h2>
              {loading ? <div className="loader-centered"><Loader2 className="animate-spin" size={48 /></div> : (
                <div className="grid">
                  {results.map(anime => <AnimeCard key={anime._id anime={anime vertical />)
                </div>
              )
            </section>
          </>
        )

        {activeTab === 'My List' && !query && (
          <section>
            <h2 className="section-title">My Watchlist</h2>
            <div className="grid">
              {watchlist.map(anime => <AnimeCard key={anime._id anime={anime vertical />)
              {watchlist.length === 0 && <p className="empty-message">Your list is empty.</p>
            </div>
          </section>
        )

        {((activeTab !== 'Home' && activeTab !== 'My List') || query) && (
          <section>
            <h2 className="section-title">{query ? `Results for "${query"` : activeTab</h2>
            {loading ? <div className="loader-centered"><Loader2 className="animate-spin" size={48 /></div> : (
              <div className="grid">
                {results.map(anime => <AnimeCard key={anime._id anime={anime vertical />)
              </div>
            )
          </section>
        )
      </main>

      {selectedAnime && (
        <div className="modal-overlay" onClick={() => { if(!loading) setSelectedAnime(null); setSelectedEpisode(null); setActiveLink(null); >
          <div className="modal-content" onClick={e => e.stopPropagation()>
            <button className="close-modal" onClick={() => { setSelectedAnime(null); setSelectedEpisode(null); setActiveLink(null); >
              <X size={24 />
            </button>

            {selectedEpisode ? (
              <div className="player-wrapper">
                <div className="player-container">
                  {activeLink ? <video ref={videoRef className="plyr-react plyr" playsInline controls /> : 
                   activeSource?.type === 'iframe' ? <iframe src={activeSource.decodedUrl allowFullScreen /> :
                   <div className="loader-centered"><Loader2 className="animate-spin" /></div>
                </div>
                <div className="player-info">
                  <h3>{selectedAnime.name - Episode {selectedEpisode</h3>
                  <div className="source-list">
                    {sources.map(s => (
                      <button key={s.sourceName className={`source-btn ${activeSource?.sourceName === s.sourceName ? 'active' : ''`
                              onClick={() => { setActiveSource(s); if(s.links?.[0]) setActiveLink(s.links[0]); >
                        {s.sourceName
                      </button>
                    ))
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="modal-hero">
                  <img src={selectedAnime.thumbnail alt={selectedAnime.name />
                  <div className="modal-hero-overlay">
                    <h1>{selectedAnime.name</h1>
                    <div className="modal-actions">
                      <button className="primary-btn" onClick={() => loadEpisode(episodes[0] || "1")>
                        <Play fill="black" size={20 /> Watch Now
                      </button>
                      <button className="secondary-btn" onClick={(e) => toggleWatchlist(e, selectedAnime)>
                        {watchlist.find(w => w._id === selectedAnime._id) ? <Check size={20 color="#7c3aed" /> : <Plus size={20 />
                        List
                      </button>
                    </div>
                  </div>
                </div>
                <div className="episode-section">
                  <h2 className="section-title">Episodes</h2>
                  <div className="episode-grid">
                    {episodes.map((ep, idx) => (
                      <div key={ep className="episode-item" onClick={() => loadEpisode(ep)>
                        <div className="episode-num">{idx + 1</div>
                        <div className="episode-label">Episode {ep</div>
                        <Play size={18 className="episode-play" />
                      </div>
                    ))
                  </div>
                </div>
              </>
            )
          </div>
        </div>
      )
    </div>
  );


export default App;
