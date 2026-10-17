import { el } from 'redom';
import type { Store } from '../store';
import { icons } from '../icons';

export class Header {
  el: HTMLElement;
  private store: Store;
  private onSearch: (query: string) => void;
  private onEditProfile: () => void;
  private onLogout: () => void;

  private searchInput: HTMLInputElement;
  private usernameEl: HTMLElement;
  private avatarEl: HTMLElement;
  private menuEl: HTMLElement;
  private userBtn: HTMLButtonElement;

  constructor(
    store: Store,
    onSearch: (q: string) => void,
    onEditProfile: () => void,
    onLogout: () => void,
  ) {
    this.store = store;
    this.onSearch = onSearch;
    this.onEditProfile = onEditProfile;
    this.onLogout = onLogout;

    const logoEl = el('div.header__logo-link',
      el('span.header__logo', { innerHTML: icons.logoIcon }),
    );

    this.searchInput = el('input.header__search-input', {
      type: 'text',
      placeholder: 'Что будем искать?',
    }) as HTMLInputElement;

    this.searchInput.addEventListener('input', () => {
      this.onSearch(this.searchInput.value.trim());
    });

    this.usernameEl = el('span.header__username', store.getUsername() ?? 'user');
    this.avatarEl = el('div.header__avatar');

    this.menuEl = el('div.header__menu',
      el('button.header__menu-item', {
        type: 'button',
        onclick: () => {
          this.closeMenu();
          this.onEditProfile();
        },
      },
        el('span.header__menu-icon', { innerHTML: icons.edit }),
        'Редактировать профиль',
      ),
      el('div.header__menu-separator'),
      el('button.header__menu-item.header__menu-item--danger', {
        type: 'button',
        onclick: () => {
          this.closeMenu();
          this.onLogout();
        },
      },
        el('span.header__menu-icon', { innerHTML: icons.logout }),
        'Выйти',
      ),
    );

    this.userBtn = el('button.header__user-btn', {
      type: 'button',
      title: 'Меню пользователя',
      onclick: (e: Event) => {
        e.stopPropagation();
        this.toggleMenu();
      },
    },
      this.avatarEl,
      this.usernameEl,
      el('span.header__user-arrow', { innerHTML: icons.chevronDown }),
    ) as HTMLButtonElement;

    this.el = el('header.header',
      logoEl,
      el('div.header__search',
        el('span.header__search-icon', { innerHTML: icons.search }),
        this.searchInput,
      ),
      el('div.header__user', this.userBtn, this.menuEl),
    );
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('keydown', this.handleEscape);
  }

  private handleDocumentClick = (e: MouseEvent): void => {
    if (!this.menuEl.classList.contains('header__menu--open')) return;
    const target = e.target as Node;
    if (this.userBtn.contains(target) || this.menuEl.contains(target)) return;
    this.closeMenu();
  };

  private handleEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.closeMenu();
    }
  };

  private toggleMenu(): void {
    this.menuEl.classList.toggle('header__menu--open');
    this.userBtn.classList.toggle('header__user-btn--open');
  }

  private closeMenu(): void {
    this.menuEl.classList.remove('header__menu--open');
    this.userBtn.classList.remove('header__user-btn--open');
  }

  destroy(): void {
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleEscape);
  }

  update(): void {
    const username = this.store.getUsername();
    if (username) {
      this.usernameEl.textContent = username;
    }

    const avatar = this.store.getProfile()?.avatar ?? null;
    if (avatar) {
      this.avatarEl.classList.add('header__avatar--photo');
      this.avatarEl.style.backgroundImage = `url("${avatar}")`;
      this.avatarEl.innerHTML = '';
    } else {
      this.avatarEl.classList.remove('header__avatar--photo');
      this.avatarEl.style.backgroundImage = '';
      this.avatarEl.innerHTML = (username ?? 'U').charAt(0).toUpperCase();
    }
  }

  clearSearch(): void {
    this.searchInput.value = '';
  }
}
