import { el } from 'redom';
import type { Api } from '../api';
import type { Store } from '../store';
import type { Track, ListMode } from '../types';
import { icons } from '../icons';

const PAGE_SIZE_DESKTOP = 10;
const PAGE_SIZE_MOBILE = 5;
const MOBILE_BREAKPOINT = 768;

function formatDuration(minutes: number): string {
  const totalSec = Math.round(minutes * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatRelativeDate(iso: string): string {
  const added = new Date(iso);
  if (Number.isNaN(added.getTime())) return '—';
  const startOf = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(added)) / 86_400_000);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  const mod10 = days % 10;
  const mod100 = days % 100;
  const unit =
    mod10 === 1 && mod100 !== 11 ? 'день'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'дня'
        : 'дней';
  return `${days} ${unit} назад`;
}

export class TrackList {
  el: HTMLElement;
  private store: Store;
  private api: Api;
  private onPlayTrack: (track: Track) => void;
  private onFavoritesChanged?: () => void;
  private mode: ListMode;
  private titleEl: HTMLElement;
  private tableHeadEl: HTMLElement;
  private tableBodyEl: HTMLElement;
  private paginationEl: HTMLElement;
  private loadingEl: HTMLElement;
  private emptyEl: HTMLElement;
  private tracks: Track[] = [];
  private filteredTracks: Track[] = [];
  private currentPage = 1;
  private pageSize = PAGE_SIZE_DESKTOP;
  private isMobile = false;
  private searchQuery = '';
  private intersectionObserver: IntersectionObserver | null = null;

  constructor(
    store: Store,
    api: Api,
    mode: ListMode,
    onPlayTrack: (track: Track) => void,
    onFavoritesChanged?: () => void,
  ) {
    this.store = store;
    this.api = api;
    this.mode = mode;
    this.onPlayTrack = onPlayTrack;
    this.onFavoritesChanged = onFavoritesChanged;

    this.titleEl = el('h2.tracklist__title',
      mode === 'tracks' ? 'Аудифайлы и треки' : 'Избранное',
    );

    this.tableHeadEl = el('div.tracklist__head',
      el('div.tracklist__col-num', el('span', { innerHTML: icons.number })),
      el('div.tracklist__col-title', 'Название'),
      el('div.tracklist__col-album', 'Альбом'),
      el('div.tracklist__col-added', el('span', { innerHTML: icons.calendar })),
      el('div.tracklist__col-fav'),
      el('div.tracklist__col-duration', el('span', { innerHTML: icons.clock })),
      el('div.tracklist__col-actions', ''),
    );

    this.tableBodyEl = el('div.tracklist__body');
    this.paginationEl = el('div.tracklist__pagination');
    this.loadingEl = el('div.tracklist__loading', 'Загрузка...');
    this.emptyEl = el('div.tracklist__empty', 'Нет треков');

    this.el = el('div.tracklist',
      this.titleEl,
      this.loadingEl,
      el('div.tracklist__table', this.tableHeadEl, this.tableBodyEl),
      this.emptyEl,
      this.paginationEl,
    );

    this.checkMobile();
    window.addEventListener('resize', () => this.checkMobile());
  }

  private checkMobile(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    this.pageSize = this.isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;
    if (wasMobile !== this.isMobile) {
      this.currentPage = 1;
      this.render();
    }
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.currentPage = 1;
    this.filterTracks();
    this.render();
  }

  update(): void {
    const source = this.mode === 'tracks'
      ? this.store.getTracks()
      : this.store.getFavorites();
    this.tracks = source.filter((t): t is Track => t != null);
    this.filterTracks();
    this.render();
  }

  private filterTracks(): void {
  if (!this.searchQuery) {
    this.filteredTracks = this.tracks.filter((t): t is Track => t != null);
  } else {
    const q = this.searchQuery.toLowerCase();
    this.filteredTracks = this.tracks.filter(
      (t) =>
        t != null &&
        (t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q)),
    );
  }
}

  private render(): void {
    this.loadingEl.style.display = this.tracks.length === 0 && this.searchQuery === '' ? 'block' : 'none';
    this.tableBodyEl.innerHTML = '';
    this.paginationEl.innerHTML = '';

    if (this.filteredTracks.length === 0) {
      this.emptyEl.style.display = 'block';
      this.paginationEl.style.display = 'none';
      return;
    }

    this.emptyEl.style.display = 'none';

    if (this.isMobile) {
      this.renderMobile();
    } else {
      this.renderDesktop();
    }
  }

  private renderDesktop(): void {
    this.paginationEl.style.display = 'flex';
    const totalPages = Math.ceil(this.filteredTracks.length / this.pageSize);
    if (this.currentPage > totalPages) this.currentPage = 1;

    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, this.filteredTracks.length);
    const pageTracks = this.filteredTracks.slice(start, end);

    for (let i = 0; i < pageTracks.length; i++) {
      this.tableBodyEl.appendChild(this.createRow(pageTracks[i], start + i + 1));
    }

    this.renderPagination(totalPages);
  }

  private renderMobile(): void {
    this.paginationEl.style.display = 'none';
    const visibleCount = this.currentPage * this.pageSize;
    const visibleTracks = this.filteredTracks.slice(0, visibleCount);

    for (let i = 0; i < visibleTracks.length; i++) {
      this.tableBodyEl.appendChild(this.createRow(visibleTracks[i], i + 1));
    }

    this.setupLazyLoad();
  }

  private setupLazyLoad(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    const sentinel = el('div.tracklist__sentinel');
    this.tableBodyEl.appendChild(sentinel);

    this.intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const visibleCount = this.currentPage * this.pageSize;
          if (visibleCount < this.filteredTracks.length) {
            this.currentPage++;
            this.renderMobile();
          } else {
            sentinel.remove();
          }
        }
      }
    }, { rootMargin: '150px' });

    this.intersectionObserver.observe(sentinel);
  }

  private createRow(track: Track, rowNum: number): HTMLElement {
    const isFav = this.store.isFavorite(track.id);
    const currentTrack = this.store.getCurrentTrack();
    const isCurrent = currentTrack != null && String(currentTrack.id) === String(track.id);

    const coverEl = el('div.track-row__cover',
      el('span.track-row__cover-icon', { innerHTML: icons.musicNote }),
    );

    const titleEl = el('div.track-row__title',
      el('span.track-row__name', track.title),
      el('span.track-row__artist', track.artist),
    );

    const durationEl = el('span.track-row__duration-text',
      track.duration != null ? formatDuration(track.duration) : '—',
    );

    const albumEl = el('div.track-row__album',
      track.album != null && track.album !== '' ? track.album : '—',
    );

    const addedEl =
      el('span.track-row__added-text',
        track.addedAt != null ? formatRelativeDate(track.addedAt) : '—',
      );

    const heartIcon = isFav ? icons.heart : icons.heartOutline;
    const favBtn = el('button.track-row__fav', {
      title: isFav ? 'Убрать из избранного' : 'Добавить в избранное',
      onclick: (e: Event) => {
        e.stopPropagation();
        void this.toggleFavorite(track);
      },
      innerHTML: heartIcon,
    });

    if (isFav) {
      favBtn.classList.add('track-row__fav--active');
    }

    const menu = el('div.track-row__menu',
      el('button.track-row__menu-item', {
        onclick: (e: Event) => {
          e.stopPropagation();
          this.closeAllMenus();
          void this.toggleFavorite(track);
        },
      }, 'Удалить из избранного'),
    );

    const moreBtn = el('button.track-row__more', {
      onclick: (e: Event) => {
        e.stopPropagation();
        if (!isFav) return;
        const wasOpen = menu.classList.contains('track-row__menu--open');
        this.closeAllMenus();
        if (!wasOpen) {
          menu.classList.add('track-row__menu--open');
        }
      },
      innerHTML: icons.more,
    });

    const row = el('div.track-row', {
      onclick: () => this.onPlayTrack(track),
    },
      el('div.track-row__num', String(rowNum)),
      el('div.track-row__info', coverEl, titleEl),
      albumEl,
      addedEl,
      favBtn,
      durationEl,
      el('div.track-row__actions', moreBtn, menu),
    );

    if (isCurrent) {
      row.classList.add('track-row--current');
    }

    return row;
  }

  private renderPagination(totalPages: number): void {
    if (totalPages <= 1) {
      this.paginationEl.style.display = 'none';
      return;
    }

    const prevBtn = el('button.tracklist__page-btn', {
      onclick: () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.render();
        }
      },
      disabled: this.currentPage === 1,
    }, '←');

    const nextBtn = el('button.tracklist__page-btn', {
      onclick: () => {
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.render();
        }
      },
      disabled: this.currentPage === totalPages,
    }, '→');

    const pages: HTMLElement[] = [prevBtn];

    for (let p = 1; p <= totalPages; p++) {
      const pageBtn = el('button.tracklist__page-btn', {
        onclick: () => {
          this.currentPage = p;
          this.render();
        },
      }, String(p));

      if (p === this.currentPage) {
        pageBtn.classList.add('tracklist__page-btn--active');
      }
      pages.push(pageBtn);
    }

    pages.push(nextBtn);

    for (const p of pages) {
      this.paginationEl.appendChild(p);
    }
  }

  private closeAllMenus(): void {
    const openMenus = this.el.querySelectorAll('.track-row__menu--open');
    openMenus.forEach((m) => m.classList.remove('track-row__menu--open'));
  }

  private async toggleFavorite(track: Track): Promise<void> {
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
      this.render();
      this.onFavoritesChanged?.();
    } catch (err) {
      console.error('Ошибка работы с избранным:', err);
    }
  }
}
