import type {
  Track,
  UserProfile,
  ProfileUpdate,
  AuthResponse,
  RegisterResponse,
  MessageResponse,
} from './types';

const BASE_URL = '/api';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export class Api {
  private token: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  setUnauthorizedHandler(handler: () => void): void {
    this.onUnauthorized = handler;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.headers) {
      const optHeaders = options.headers as Record<string, string>;
      for (const key of Object.keys(optHeaders)) {
        headers[key] = optHeaders[key];
      }
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
    });

    if (response.status === 304) {
      response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
        cache: 'reload',
      });
    }

    if (!response.ok) {
      let message = 'Произошла ошибка';
      try {
        const errorData = (await response.json()) as { message?: string };
        if (errorData.message) {
          message = errorData.message;
        }
      } catch {
      }
      const authLost =
        response.status === 401 ||
        response.status === 403 ||
        message === 'токен некорректный' ||
        message === 'доступ запрещен';
      if (authLost) {
        this.onUnauthorized?.();
      }

      throw new ApiError(message, response.status);
    }

    return (await response.json()) as T;
  }

  async register(username: string, password: string): Promise<RegisterResponse> {
    return this.request<RegisterResponse>('/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async getTracks(): Promise<Track[]> {
    return this.request<Track[]>('/tracks');
  }

  async getFavorites(): Promise<Track[]> {
    return this.request<Track[]>('/favorites');
  }

  async addFavorite(trackId: string | number): Promise<MessageResponse> {
    return this.request<MessageResponse>('/favorites', {
      method: 'POST',
      body: JSON.stringify({ trackId }),
    });
  }

  async removeFavorite(trackId: string | number): Promise<MessageResponse> {
    return this.request<MessageResponse>('/favorites', {
      method: 'DELETE',
      body: JSON.stringify({ trackId }),
    });
  }

  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/profile');
  }

  async updateProfile(data: ProfileUpdate): Promise<UserProfile> {
    return this.request<UserProfile>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  private static readonly SOUNDHELIX_SONGS = 17;

  getAudioUrls(trackId: string | number): string[] {
    const songIndex = ((Number(trackId) - 1) % Api.SOUNDHELIX_SONGS) + 1;
    return [
      `${BASE_URL}/tracks/${trackId}/audio`,
      `/tracks/${trackId}/audio`,
      `${BASE_URL}/audio/${trackId}.mp3`,
      `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${songIndex}.mp3`,
    ];
  }
}
