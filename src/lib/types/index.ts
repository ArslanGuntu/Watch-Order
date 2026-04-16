// ─── DOMAIN TYPES ────────────────────────────────────────────────────────────
// App-level types (separate from raw TMDB API types)

export type ContentType = 'franchises' | 'movies' | 'anime' | 'series';

export interface MediaItem {
  id: string;
  tmdbId: number;
  type: ContentType;
  title: string;
  desc: string;
  poster: string;
  bg: string;
  years: string;
  year: string;
  entries: number;
  label: string;
  labelCls: string;
  // Optional enrichment
  ratingNum?: number;
  rating?: string;
  status?: string;
}

export interface GuideEntry {
  id: number;
  order: number;
  title?: string;
  name?: string;
  overview: string;
  posterUrl: string;
  backdropUrl?: string;
  release_date?: string;
  first_air_date?: string;
  air_date?: string;
  rating: string;
  ratingNum: number;
  runtime?: string;
  director?: string;
  streamingServices?: StreamingService[];
  // TV-specific
  season_number?: number;
  episode_count?: number;
}

export interface StreamingService {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  link?: string;
}

export interface SelectedItem {
  id: number | string;
  type: ContentType;
  title: string;
  desc: string;
  poster: string;
  posterUrl?: string;
  bg: string;
  years: string;
  year: string;
  entries: number;
  ratingNum?: number;
  rating?: string;
  status?: string;
}

// ─── RECOMMENDATION TYPES ────────────────────────────────────────────────────

export type MediaTypeFilter = 'movie' | 'tv' | 'anime';

export interface RecommendationFilters {
  genres: string[];
  era?: { years: [number, number] };
  quality?: { min: number };
  language?: string;
  certification?: string;
  sort?: string;
  votes?: { minV: number };
  similarTitle?: { id: number; title: string; year: string; media_type: string } | null;
}

// ─── AUTH TYPES ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}
