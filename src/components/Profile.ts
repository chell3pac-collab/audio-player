import { el } from 'redom';
import { ApiError } from '../api';
import type { Api } from '../api';
import type { Store } from '../store';
import type { ProfileUpdate } from '../types';
import { icons } from '../icons';
import { fileToAvatarDataUrl } from '../utils/avatar';

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export class Profile {
  el: HTMLElement;
  private store: Store;
  private api: Api;
  private onLogout: () => void;
  private onProfileUpdated: () => void;
  private isEditing = false;
  private isSaving = false;
  private pendingAvatar: string | null | undefined = undefined;
  private fileInput: HTMLInputElement;
  private errorEl: HTMLElement | null = null;
  private editAvatarEl: HTMLElement | null = null;
  private removeAvatarBtn: HTMLButtonElement | null = null;
  private saveBtn: HTMLButtonElement | null = null;

  constructor(
    store: Store,
    api: Api,
    onLogout: () => void,
    onProfileUpdated: () => void,
  ) {
    this.store = store;
    this.api = api;
    this.onLogout = onLogout;
    this.onProfileUpdated = onProfileUpdated;

    this.fileInput = el('input.profile__file-input', {
      type: 'file',
      accept: 'image/*',
    }) as HTMLInputElement;
    this.fileInput.addEventListener('change', () => {
      void this.onAvatarFileSelected(this.fileInput.files?.[0]);
      this.fileInput.value = '';
    });

    this.el = el('div.profile');
    this.render();
  }

  update(): void {
    if (this.isEditing) return;
    this.render();
  }

  private render(): void {
    this.el.innerHTML = '';
    const card = el('div.profile__card');
    card.appendChild(this.fileInput);

    if (this.isEditing) {
      this.renderEdit(card);
    } else {
      this.renderView(card);
    }
    this.el.appendChild(card);
  }

  private renderView(card: HTMLElement): void {
    const profile = this.store.getProfile();
    const username = this.store.getUsername() ?? 'user';
    const name = profile?.displayName?.trim() || username;
    const errorEl = el('div.profile__error');
    errorEl.style.display = 'none';
    this.errorEl = errorEl;

    const avatarBlock = this.createAvatarBlock(false);
    const stats = el('div.profile__stats',
      el('div.profile__stat',
        el('span.profile__stat-label', 'Композиций в библиотеке'),
        el('span.profile__stat-value', String(this.store.getTracks().length)),
      ),
      el('div.profile__stat',
        el('span.profile__stat-label', 'В избранном'),
        el('span.profile__stat-value', String(this.store.getFavorites().length)),
      ),
    );

    const actions = el('div.profile__actions',
      el('button.profile__edit-btn', {
        type: 'button',
        onclick: () => {
          this.isEditing = true;
          this.pendingAvatar = undefined;
          this.render();
        },
      },
        
        'Редактировать профиль',
      ),
      el('button.profile__logout', {
        type: 'button',
        onclick: () => this.onLogout(),
      },
        el('span', { innerHTML: icons.logout }),
        'Выйти',
      ),
    );

    card.appendChild(avatarBlock);
    card.appendChild(el('h2.profile__username', name));
    card.appendChild(el('div.profile__login', `@${username}`));
    card.appendChild(this.createFieldsList(profile));
    card.appendChild(stats);
    card.appendChild(errorEl);
    card.appendChild(actions);
  }

  private createFieldsList(profile: ReturnType<Store['getProfile']>): HTMLElement {
    const username = this.store.getUsername() ?? '';
    const row = (label: string, value: string | null | undefined): HTMLElement => {
      const hasValue = value != null && value.trim() !== '';
      return el('div.profile__field',
        el('span.profile__field-label', label),
        hasValue
          ? el('span.profile__field-value', value as string)
          : el('span.profile__field-value.profile__field-value--empty', 'не указано'),
      );
    };

    return el('div.profile__fields',
      row('Логин', username),
      row('Имя', profile?.displayName),
      row('Email', profile?.email),
      row('О себе', profile?.bio),
      row('Дата регистрации', profile?.createdAt ? formatDate(profile.createdAt) : null),
    );
  }

  private renderEdit(card: HTMLElement): void {
    const profile = this.store.getProfile();

    const errorEl = el('div.profile__error');
    errorEl.style.display = 'none';
    this.errorEl = errorEl;

    const nameInput = el('input.profile__input', {
      type: 'text',
      placeholder: 'Как вас называть?',
      maxlength: 50,
    }) as HTMLInputElement;
    nameInput.value = profile?.displayName ?? '';

    const emailInput = el('input.profile__input', {
      type: 'email',
      placeholder: 'user@example.com',
      maxlength: 100,
    }) as HTMLInputElement;
    emailInput.value = profile?.email ?? '';

    const bioInput = el('textarea.profile__textarea', {
      placeholder: 'Пара слов о себе',
      maxlength: 300,
    }) as HTMLTextAreaElement;
    bioInput.value = profile?.bio ?? '';

    const avatarBlock = this.createAvatarBlock(true);

    const cancelBtn = el('button.profile__cancel-btn', {
      type: 'button',
      onclick: () => this.cancelEdit(),
    }, 'Отмена');

    this.saveBtn = el('button.profile__save-btn', { type: 'submit' }, 'Сохранить') as HTMLButtonElement;

    const form = el('form.profile__form', {
      onsubmit: (e: Event) => {
        e.preventDefault();
        void this.submitProfile(nameInput.value, emailInput.value, bioInput.value);
      },
    },
      avatarBlock,
      el('label.profile__form-label',
        'Отображаемое имя',
        nameInput,
      ),
      el('label.profile__form-label',
        'Email',
        emailInput,
      ),
      el('label.profile__form-label',
        'О себе',
        bioInput,
      ),
      errorEl,
      el('div.profile__form-actions', cancelBtn, this.saveBtn),
    );

    card.appendChild(form);
  }

  private createAvatarBlock(editing: boolean): HTMLElement {
    const profile = this.store.getProfile();
    const url = editing
      ? (this.pendingAvatar !== undefined ? this.pendingAvatar : profile?.avatar ?? null)
      : profile?.avatar ?? null;

    const avatarEl = el('div.profile__avatar');
    this.applyAvatarBackground(avatarEl, url);
    const wrap = el('div.profile__avatar-wrap', avatarEl);

    const cameraBtn = el('button.profile__avatar-camera', {
      type: 'button',
      title: 'Загрузить фото',
      onclick: (e: Event) => {
        e.stopPropagation();
        this.fileInput.click();
      },
    }, el('span', { innerHTML: icons.camera }));
    wrap.appendChild(cameraBtn);

    if (editing) {
      this.editAvatarEl = avatarEl;
      this.removeAvatarBtn = el('button.profile__avatar-remove', {
        type: 'button',
        title: 'Удалить фото',
        onclick: (e: Event) => {
          e.stopPropagation();
          this.pendingAvatar = null;
          if (this.editAvatarEl) {
            this.applyAvatarBackground(this.editAvatarEl, null);
          }
          this.removeAvatarBtn?.style.setProperty('display', 'none');
        },
      }, el('span', { innerHTML: icons.close })) as HTMLButtonElement;
      this.removeAvatarBtn.style.display = url ? 'flex' : 'none';
      wrap.appendChild(this.removeAvatarBtn);
    } else {
      this.editAvatarEl = null;
      this.removeAvatarBtn = null;
    }

    return wrap;
  }

  private applyAvatarBackground(target: HTMLElement, url: string | null): void {
    if (url) {
      target.classList.add('profile__avatar--photo');
      target.style.backgroundImage = `url("${url}")`;
      target.innerHTML = '';
    } else {
      target.classList.remove('profile__avatar--photo');
      target.style.backgroundImage = '';
      target.innerHTML = (this.store.getUsername() ?? 'U').charAt(0).toUpperCase();
    }
  }

  private async onAvatarFileSelected(file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      if (this.isEditing) {
        this.pendingAvatar = dataUrl;
        if (this.editAvatarEl) {
          this.applyAvatarBackground(this.editAvatarEl, dataUrl);
        }
        this.removeAvatarBtn?.style.removeProperty('display');
      } else {
        await this.saveAvatar(dataUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось обработать изображение';
      this.showError(message);
    }
  }

  private async saveAvatar(dataUrl: string): Promise<void> {
    if (this.isSaving) return;
    this.isSaving = true;
    this.hideError();
    try {
      const profile = await this.api.updateProfile({ avatar: dataUrl });
      this.store.setProfile(profile);
      this.onProfileUpdated();
      this.render();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Не удалось загрузить фото';
      this.showError(message);
    } finally {
      this.isSaving = false;
    }
  }

  private async submitProfile(
    nameValue: string,
    emailValue: string,
    bioValue: string,
  ): Promise<void> {
    if (this.isSaving) return;

    const displayName = nameValue.trim();
    const email = emailValue.trim();
    const bio = bioValue.trim();

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      this.showError('Введите корректный email');
      return;
    }

    this.isSaving = true;
    this.updateSaveBtn();
    this.hideError();

    try {
      const data: ProfileUpdate = {
        displayName: displayName || null,
        email: email || null,
        bio: bio || null,
      };
      if (this.pendingAvatar !== undefined) {
        data.avatar = this.pendingAvatar;
      }

      const profile = await this.api.updateProfile(data);
      this.store.setProfile(profile);
      this.isEditing = false;
      this.pendingAvatar = undefined;
      this.onProfileUpdated();
      this.render();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Не удалось сохранить профиль';
      this.showError(message);
    } finally {
      this.isSaving = false;
      this.updateSaveBtn();
    }
  }

  private cancelEdit(): void {
    this.isEditing = false;
    this.pendingAvatar = undefined;
    this.hideError();
    this.render();
  }

  private updateSaveBtn(): void {
    if (!this.saveBtn) return;
    this.saveBtn.disabled = this.isSaving;
    this.saveBtn.textContent = this.isSaving ? 'Сохранение...' : 'Сохранить';
  }

  private showError(message: string): void {
    if (!this.errorEl) return;
    this.errorEl.textContent = message;
    this.errorEl.style.display = 'block';
  }

  private hideError(): void {
    this.errorEl?.style.setProperty('display', 'none');
  }
}
