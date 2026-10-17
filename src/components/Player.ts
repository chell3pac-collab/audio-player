import { el } from 'redom';
import type { Api } from '../api';
import type { Store } from '../store';
import type { Track, RepeatMode } from '../types';
import { icons } from '../icons';
import { generateTrackAudio } from '../utils/audioGenerator';

export class Player {
  el: HTMLElement;
  private audio: HTMLAudioElement;
  private store: Store;
  private api: Api;
  private onNext: () => void;
  private onPrev: () => void;
  private onFavoritesChanged: () => void;

  private titleEl: HTMLElement;
  private artistEl: HTMLElement;
  private favBtn: HTMLButtonElement;
  private progressContainer: HTMLElement;
  private progressFill: HTMLElement;
  private progressHandle: HTMLElement;
  private currentTimeEl: HTMLElement;
  private totalTimeEl: HTMLElement;
  private playBtnMobile: HTMLButtonElement;
  private playBtnDesktop: HTMLButtonElement;
  private shuffleBtn: HTMLButtonElement;
  private repeatBtn: HTMLButtonElement;
  private volumeSlider: HTMLInputElement;
  private volumeIcon: HTMLElement;
  private isPlaying = false;
  private isShuffled = false;
  private repeatMode: RepeatMode = 'off';
  private currentTrack: Track | null = null;
  private candidateUrls: string[] = [];
  private candidateIndex = 0;

  constructor(
    store: Store,
    api: Api,
    onNext: () => void,
    onPrev: () => void,
    onFavoritesChanged: () => void,
  ) {
    this.store = store;
    this.api = api;
    this.onNext = onNext;
    this.onPrev = onPrev;
    this.onFavoritesChanged = onFavoritesChanged;

    this.audio = new Audio();
    this.audio.preload = 'metadata';

    this.titleEl = el('span.player__title', 'Трек не выбран');
    this.artistEl = el('span.player__artist', '');

    this.progressFill = el('div.player__progress-fill');
    this.progressHandle = el('div.player__progress-handle');
    this.currentTimeEl = el('span.player__time', '0:00');
    this.totalTimeEl = el('span.player__time', '0:00');

    this.progressContainer = el('div.player__progress', {
      onclick: (e: MouseEvent) => this.handleSeek(e),
    },
      this.progressFill,
      this.progressHandle,
    );

    this.playBtnMobile = this.createPlayButton('player__btn--play-mini');
    this.playBtnDesktop = this.createPlayButton();

    this.shuffleBtn = el('button.player__btn.player__btn--toggle', {
      onclick: () => this.toggleShuffle(),
      innerHTML: icons.shuffle,
    }) as HTMLButtonElement;

    this.repeatBtn = el('button.player__btn.player__btn--toggle', {
      onclick: () => this.toggleRepeat(),
      innerHTML: icons.repeat,
    }) as HTMLButtonElement;

    this.volumeSlider = el('input.player__volume-slider', {
      type: 'range',
      min: '0',
      max: '100',
      value: '100',
    }) as HTMLInputElement;

    this.volumeIcon = el('span.player__volume-icon', { innerHTML: icons.volume });

    this.volumeSlider.addEventListener('input', () => {
      this.setVolume(Number(this.volumeSlider.value) / 100);
    });

    this.favBtn = el('button.player__fav', {
      title: 'Добавить в избранное',
      onclick: () => void this.toggleFavorite(),
      innerHTML: icons.heartOutline,
    }) as HTMLButtonElement;

    this.el = el('div.player',
      el('div.player__info',
        el('div.player__cover', el('span.player__cover-icon', { innerHTML: icons.musicNote })),
        el('div.player__track-info',
          el('div.player__wrapper', this.titleEl, this.favBtn,), this.artistEl),
      ),
      this.playBtnMobile,
      el('div.player__inner',
        el('div.player__controls',
          this.shuffleBtn,
          el('button.player__btn', {
            onclick: () => this.onPrev(),
            innerHTML: icons.prev,
          }),
          el('button.player__btn', {
            onclick: () => this.seekBy(-10),
            title: 'Назад на 10 секунд',
            innerHTML: icons.rewind,
          }),
          this.playBtnDesktop,
          el('button.player__btn', {
            onclick: () => this.seekBy(10),
            title: 'Вперёд на 10 секунд',
            innerHTML: icons.forward,
          }),
          el('button.player__btn', {
            onclick: () => this.onNext(),
            innerHTML: icons.next,
          }),
          this.repeatBtn,
        ),
        el('div.player__progress-row',
          this.currentTimeEl,
          this.progressContainer,
          this.totalTimeEl,
        ),
      ),
      el('div.player__volume', this.volumeIcon, this.volumeSlider),
    );

    this.setupAudioEvents();
    this.setupKeyboardShortcuts();
  }

  private createPlayButton(modifier?: string): HTMLButtonElement {
    return el(`button.player__btn.player__btn--play${modifier ? `.${modifier}` : ''}`, {
      onclick: () => this.togglePlay(),
      innerHTML: icons.play,
    }) as HTMLButtonElement;
  }

  private updatePlayButtons(): void {
    const icon = this.isPlaying ? icons.pause : icons.play;
    this.playBtnMobile.innerHTML = icon;
    this.playBtnDesktop.innerHTML = icon;
  }

  private setupAudioEvents(): void {
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
    this.audio.addEventListener('ended', () => this.handleTrackEnd());
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayButtons();
    });
    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayButtons();
    });
    this.audio.addEventListener('error', () => this.tryNextSource());
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.seekBy(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.seekBy(10);
          break;
      }
    });
  }

  loadTrack(track: Track): void {
    this.currentTrack = track;
    this.titleEl.textContent = track.title;
    this.artistEl.textContent = track.artist;
    this.totalTimeEl.textContent = '0:00';
    this.currentTimeEl.textContent = '0:00';
    this.updateFavButton();

    const generated = generateTrackAudio(track.id, track.duration);
    this.candidateUrls = [...this.api.getAudioUrls(track.id), generated];
    this.candidateIndex = 0;
    void this.resolveSource();
  }

  refreshFavState(): void {
    this.updateFavButton();
  }

  private updateFavButton(): void {
    if (!this.currentTrack) return;
    const isFav = this.store.isFavorite(this.currentTrack.id);
    this.favBtn.innerHTML = isFav ? icons.heart : icons.heartOutline;
    this.favBtn.classList.toggle('player__fav--active', isFav);
    this.favBtn.title = isFav ? 'Убрать из избранного' : 'Добавить в избранное';
  }

  private async toggleFavorite(): Promise<void> {
    if (!this.currentTrack) return;
    const track = this.currentTrack;
    const isFav = this.store.isFavorite(track.id);
    try {
      if (isFav) {
        await this.api.removeFavorite(track.id);
        this.store.setFavorites(
          this.store.getFavorites().filter((t) => String(t.id) !== String(track.id)),
        );
      } else {
        await this.api.addFavorite(track.id);
        this.store.setFavorites([...this.store.getFavorites(), track]);
      }
      this.updateFavButton();
      this.onFavoritesChanged();
    } catch (err) {
      console.error('[Player] ошибка работы с избранным:', err);
    }
  }

  private async resolveSource(): Promise<void> {
    for (let i = this.candidateIndex; i < this.candidateUrls.length; i++) {
      const url = this.candidateUrls[i];
      if (url.startsWith('blob:') || this.isCrossOrigin(url)) {
        this.setSource(url, i);
        return;
      }
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) {
          this.setSource(url, i);
          return;
        }
        console.warn(`[Player] источник недоступен (${res.status}): ${url}`);
      } catch {
        console.warn(`[Player] источник недоступен: ${url}`);
      }
    }
    console.warn('[Player] серверное аудио не найдено — играю сгенерированную заглушку');
    const lastIndex = this.candidateUrls.length - 1;
    this.setSource(this.candidateUrls[lastIndex], lastIndex);
  }

  private isCrossOrigin(url: string): boolean {
    try {
      return new URL(url, window.location.href).origin !== window.location.origin;
    } catch {
      return false;
    }
  }

  private setSource(url: string, index: number): void {
    console.info(`[Player] играю источник: ${url}`);
    this.candidateIndex = index;
    this.audio.src = url;
    this.audio.load();
    this.play();
  }

  private tryNextSource(): void {
    const next = this.candidateIndex + 1;
    if (next < this.candidateUrls.length) {
      void this.playFromIndex(next);
    } else {
      console.error('[Player] ни один источник аудио не сработал', this.currentTrack);
    }
  }

  private async playFromIndex(index: number): Promise<void> {
    for (let i = index; i < this.candidateUrls.length; i++) {
      const url = this.candidateUrls[i];
      if (url.startsWith('blob:') || this.isCrossOrigin(url)) {
        this.setSource(url, i);
        return;
      }
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) {
          this.setSource(url, i);
          return;
        }
        console.warn(`[Player] источник недоступен (${res.status}): ${url}`);
      } catch {
        console.warn(`[Player] источник недоступен: ${url}`);
      }
    }
    console.error('[Player] ни один источник аудио не сработал', this.currentTrack);
  }

  play(): void {
    if (!this.currentTrack) return;
    this.audio.play().catch((err: DOMException) => {
      console.error('[Player] воспроизведение отклонено браузером:', err.name, err.message);
    });
  }

  pause(): void {
    this.audio.pause();
  }

  togglePlay(): void {
    if (!this.currentTrack) return;
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seekBy(seconds: number): void {
    if (!this.audio.duration) return;
    this.audio.currentTime = Math.max(0, Math.min(this.audio.currentTime + seconds, this.audio.duration));
  }

  private handleSeek(e: MouseEvent): void {
    if (!this.audio.duration) return;
    const rect = this.progressContainer.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    this.audio.currentTime = Math.max(0, Math.min(percent * this.audio.duration, this.audio.duration));
  }

  setVolume(volume: number): void {
    this.audio.volume = Math.max(0, Math.min(volume, 1));
    this.volumeIcon.innerHTML = volume === 0 ? icons.volumeMute : icons.volume;
  }

  private toggleShuffle(): void {
    this.isShuffled = !this.isShuffled;
    this.shuffleBtn.classList.toggle('player__btn--active', this.isShuffled);
  }

  isShuffleEnabled(): boolean {
    return this.isShuffled;
  }

  private toggleRepeat(): void {
    switch (this.repeatMode) {
      case 'off':
        this.repeatMode = 'all';
        this.repeatBtn.innerHTML = icons.repeat;
        this.repeatBtn.classList.add('player__btn--active');
        break;
      case 'all':
        this.repeatMode = 'one';
        this.repeatBtn.innerHTML = icons.repeatOne;
        break;
      case 'one':
        this.repeatMode = 'off';
        this.repeatBtn.innerHTML = icons.repeat;
        this.repeatBtn.classList.remove('player__btn--active');
        break;
    }
  }

  getRepeatMode(): RepeatMode {
    return this.repeatMode;
  }

  private handleTrackEnd(): void {
    if (this.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.play();
    } else {
      this.onNext();
    }
  }

  private updateProgress(): void {
    if (!this.audio.duration) return;
    const percent = (this.audio.currentTime / this.audio.duration) * 100;
    this.progressFill.style.width = `${percent}%`;
    this.progressHandle.style.left = `${percent}%`;
    this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
  }

  private updateDuration(): void {
    this.totalTimeEl.textContent = this.formatTime(this.audio.duration);
  }

  private formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
