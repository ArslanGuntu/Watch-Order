// ─── TMDB API CONFIG ─────────────────────────────────────────────────────────
// Single source of truth — never duplicate these across pages

export const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
export const TMDB_BASE = 'https://api.themoviedb.org/3';
export const TMDB_IMG = 'https://image.tmdb.org/t/p';

export const IMG_SIZES = {
  poster_sm: `${TMDB_IMG}/w185`,
  poster_md: `${TMDB_IMG}/w342`,
  poster_lg: `${TMDB_IMG}/w500`,
  backdrop: `${TMDB_IMG}/w1280`,
  thumb: `${TMDB_IMG}/w92`,
} as const;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export function posterUrl(path: string | null | undefined, size: keyof typeof IMG_SIZES = 'poster_md'): string {
  return path ? `${IMG_SIZES[size]}${path}` : '';
}

export function backdropUrl(path: string | null | undefined): string {
  return path ? `${IMG_SIZES.backdrop}${path}` : '';
}

// ─── TYPED FETCH ─────────────────────────────────────────────────────────────

export async function tmdbFetch<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set('api_key', TMDB_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${endpoint}`);
  return res.json() as Promise<T>;
}

// ─── TYPED SEARCH ────────────────────────────────────────────────────────────

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  runtime?: number;
  tagline?: string;
  genres?: { id: number; name: string }[];
  credits?: { cast: TmdbPerson[]; crew: TmdbPerson[] };
  belongs_to_collection?: { id: number; name: string; poster_path: string | null; backdrop_path: string | null };
}

export interface TmdbTV {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date?: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  genres?: { id: number; name: string }[];
  credits?: { cast: TmdbPerson[]; crew: TmdbPerson[] };
  seasons?: TmdbSeason[];
  episode_run_time?: number[];
  origin_country?: string[];
}

export interface TmdbSeason {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string;
  episode_count: number;
  vote_average?: number;
  episodes?: TmdbEpisode[];
}

export interface TmdbEpisode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string;
  still_path: string | null;
  vote_average: number;
  runtime?: number;
}

export interface TmdbCollection {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: TmdbMovie[];
}

export interface TmdbPerson {
  id: number;
  name: string;
  character?: string;
  job?: string;
  profile_path: string | null;
  order?: number;
}

export interface TmdbSearchResult<T> {
  results: T[];
  total_pages: number;
  total_results: number;
  page: number;
}

// ─── MOVIE GENRE MAP ─────────────────────────────────────────────────────────

export const MOVIE_GENRES: Record<string, number> = {
  Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80,
  Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, History: 36,
  Horror: 27, Music: 10402, Mystery: 9648, Romance: 10749,
  'Science Fiction': 878, Thriller: 53, War: 10752, Western: 37,
};

export const TV_GENRES: Record<string, number> = {
  Action: 10759, Animation: 16, Comedy: 35, Crime: 80,
  Documentary: 99, Drama: 18, Family: 10751, Kids: 10762,
  Mystery: 9648, News: 10763, Reality: 10764, 'Sci-Fi & Fantasy': 10765,
  Soap: 10766, Talk: 10767, 'War & Politics': 10768, Western: 37,
};
