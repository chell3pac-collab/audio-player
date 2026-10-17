import { el } from 'redom';
import { Api, ApiError } from '../api';
import { Store } from '../store';
import type { Track, ViewName } from '../types';
import { Auth } from './Auth';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { TrackList } from './TrackList';
import { Profile } from './Profile';
import { Player } from './Player';
import { icons } from '../icons';

export class App {
  el = el('div.app');

  private store: Store;
  private api: Api;

  private auth: Auth | null = null;
  private sidebar: Sidebar | null = null;
  private header: Header | null = null;
  private trackList: TrackList | null = null;
  private favList: TrackList | null = null;
  private profile: Profile | null = null;
  private player: Player | null = null;

  private tracksTab: HTMLElement | null = null;
  private favTab: HTMLElement | null = null;

  private view: ViewName = 'tracks';

  constructor() {
    this.store = new Store();
    this.api = new Api();
    this.api.setToken(this.store.getToken());
    this.api.setUnauthorizedHandler(() => this.logout());

    if (this.store.isAuthenticated()) {
      this.buildMain();
      void this.loadInitialData();
    } else {
      this.buildAuthScreen();
    }
  }

  private buildAuthScreen(): void {
    this.header?.destroy();
    this.auth = new Auth(this.api, (token: string, username: string) => {
      this.store.setSession(token, username);
      this.api.setToken(token);
      this.buildMain();
      void this.loadInitialData();
    });
    this.el.innerHTML = '';
    this.el.appendChild(this.auth.el);
  }

  private buildMain(): void {
    this.el.innerHTML = '';
    this.header?.destroy();

    this.sidebar = new Sidebar((view) => this.setView(view));
    this.player = new Player(
      this.store,
      this.api,
      () => this.playNext(),
      () => this.playPrev(),
      () => this.refreshLists(),
    );

    this.trackList = new TrackList(
      this.store,
      this.api,
      'tracks',
      (track) => this.playTrack(track),
      () => this.player?.refreshFavState(),
    );
    this.favList = new TrackList(
      this.store,
      this.api,
      'favorites',
      (track) => this.playTrack(track),
      () => this.player?.refreshFavState(),
    );
    this.profile = new Profile(
      this.store,
      this.api,
      () => this.logout(),
      () => this.refreshHeader(),
    );

    this.header = new Header(
      this.store,
      (query) => {
        this.trackList?.setSearchQuery(query);
        this.favList?.setSearchQuery(query);
      },
      () => this.setView('profile'),
      () => this.logout(),
    );

    this.tracksTab = el('button.app__tab', {
      onclick: () => this.setView('tracks'),
    },
      el('span.app__tab-icon', { innerHTML: icons.audioTracks }),
      el('span.app__tab-text', 'Аудиокомпозиции'),
    );
    this.favTab = el('button.app__tab', {
      onclick: () => this.setView('favorites'),
    },
      el('span.app__tab-text', 'Избранное'),
    );
    const tabs = el('div.app__tabs', this.tracksTab, this.favTab);

    const content = el('div.app__content',
      this.header.el,
      tabs,
      el('div.app__view',
        this.trackList.el,
        this.favList.el,
        this.profile.el,
      ),
      this.player.el,
    );

    this.el.appendChild(el('div.app__main', this.sidebar.el, content));
    this.setView('tracks');
  }

  private setView(view: ViewName): void {
    this.view = view;

    if (!this.trackList || !this.favList || !this.profile || !this.sidebar) return;

    this.trackList.el.style.display = view === 'tracks' ? 'flex' : 'none';
    this.favList.el.style.display = view === 'favorites' ? 'flex' : 'none';
    this.profile.el.style.display = view === 'profile' ? 'flex' : 'none';

    this.trackList.update();
    this.favList.update();
    this.profile.update();

    this.sidebar.setActive(view);

    this.tracksTab?.classList.toggle('app__tab--active', view === 'tracks');
    this.favTab?.classList.toggle('app__tab--active', view === 'favorites');

    this.header?.clearSearch();
  }

  private refreshHeader(): void {
    this.header?.update();
  }

  private refreshLists(): void {
    this.trackList?.update();
    this.favList?.update();
  }

  private async loadInitialData(): Promise<void> {
    try {
      const [tracks, favorites, profile] = await Promise.all([
        this.api.getTracks(),
        this.api.getFavorites(),
        this.api.getProfile().catch((err: unknown) => {
          if (!(err instanceof ApiError) || err.status !== 404) {
            console.error('Ошибка загрузки профиля:', err);
          }
          return null;
        }),
      ]);
      this.store.setTracks(tracks);
      this.store.setFavorites(favorites);
      this.store.setProfile(profile);
      this.trackList?.update();
      this.favList?.update();
      this.profile?.update();
      this.header?.update();
    } catch (err) {
      if (err instanceof ApiError && (err as ApiError).status === 401) {
        this.logout();
        return;
      }
      console.error('Ошибка загрузки данных:', err);
    }
  }

  private playTrack(track: Track): void {
    this.store.setCurrentTrack(track);
    this.player?.loadTrack(track);
    this.trackList?.update();
    this.favList?.update();
  }

  private currentPlaylist(): Track[] {
    return this.view === 'favorites'
      ? (this.store.getFavorites() ?? [])
      : (this.store.getTracks() ?? []);
  }

  private playNext(): void {
    const list = this.currentPlaylist();
    const current = this.store.getCurrentTrack();
    if (list.length === 0) return;

    let index = list.findIndex((t) => String(t.id) === String(current?.id));
    if (this.player?.isShuffleEnabled()) {
      let next = index;
      while (next === index && list.length > 1) {
        next = Math.floor(Math.random() * list.length);
      }
      index = next;
    } else {
      index = (index + 1) % list.length;
    }
    this.playTrack(list[index]);
  }

  private playPrev(): void {
    const list = this.currentPlaylist();
    const current = this.store.getCurrentTrack();
    if (list.length === 0) return;

    let index = list.findIndex((t) => String(t.id) === String(current?.id));
    if (this.player?.isShuffleEnabled()) {
      let next = index;
      while (next === index && list.length > 1) {
        next = Math.floor(Math.random() * list.length);
      }
      index = next;
    } else {
      index = (index - 1 + list.length) % list.length;
    }
    this.playTrack(list[index]);
  }

  private logout(): void {
    this.player?.pause();
    this.store.clearSession();
    this.api.setToken(null);
    this.buildAuthScreen();
  }
}
