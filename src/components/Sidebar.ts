import { el } from 'redom';
import type { ViewName } from '../types';
import { icons } from '../icons';

export class Sidebar {
  el: HTMLElement;
  private navItems: Record<string, HTMLElement> = {};
  private onNavigate: (view: ViewName) => void;

  constructor(onNavigate: (view: ViewName) => void) {
    this.onNavigate = onNavigate;

    const favItem = el('button.sidebar__item', {
      onclick: () => this.navigate('favorites'),
    },
      el('span.sidebar__item-icon', { innerHTML: icons.musicNote }),
      el('span.sidebar__item-text', 'Избранное'),
    );

    const tracksItem = el('button.sidebar__item', {
      onclick: () => this.navigate('tracks'),
    },
      el('span.sidebar__item-icon', { innerHTML: icons.musicNote }),
      el('span.sidebar__item-text', 'Аудиокомпозиции'),
    );

    this.navItems['favorites'] = favItem;
    this.navItems['tracks'] = tracksItem;

    this.el = el('aside.sidebar',
      el('header.sidebar__header',
        el('div.sidebar__logo',
          el('span.sidebar__logo-icon', { innerHTML: icons.logoIcon }),
        ),
      ),
      el('nav.sidebar__nav',
        favItem,
        tracksItem,
      ),
    );
  }

  setActive(view: ViewName): void {
    for (const key of Object.keys(this.navItems)) {
      this.navItems[key].classList.remove('sidebar__item--active');
    }
    if (this.navItems[view]) {
      this.navItems[view].classList.add('sidebar__item--active');
    }
  }

  private navigate(view: ViewName): void {
    this.setActive(view);
    this.onNavigate(view);
  }
}
