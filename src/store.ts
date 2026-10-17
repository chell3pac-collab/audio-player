import type { Track, UserProfile } from './types';

const TOKEN_KEY = 'audio-player-token';
const USERNAME_KEY = 'audio-player-username';

export class Store {
  private token: string | null = null;
  private username: string | null = null;
  private tracks: Track[] = [];
  private favorites: Track[] = [];
  private currentTrack: Track | null = null;
  private profile: UserProfile | null = null;

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
    this.username = localStorage.getItem(USERNAME_KEY);
  }

  getToken(): string | null {
    return this.token;
  }

  getUsername(): string | null {
    return this.username;
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  setSession(token: string, username: string): void {
    this.token = token;
    this.username = username;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USERNAME_KEY, username);
  }

  clearSession(): void {
    this.token = null;
    this.username = null;
    this.profile = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
  }

  getTracks(): Track[] {
    return this.tracks;
  }

  setTracks(tracks: Track[]): void {
    this.tracks = tracks;
  }

  getFavorites(): Track[] {
    return this.favorites;
  }

  setFavorites(favorites: Track[]): void {
    this.favorites = favorites;
  }

  isFavorite(trackId: string | number): boolean {
    return this.favorites.some((t) => String(t.id) === String(trackId));
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  setCurrentTrack(track: Track | null): void {
    this.currentTrack = track;
  }

  getProfile(): UserProfile | null {
    return this.profile;
  }

  setProfile(profile: UserProfile | null): void {
    this.profile = profile;
  }
}
