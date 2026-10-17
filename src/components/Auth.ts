import { el } from 'redom';
import { Api, ApiError } from '../api';
import { icons } from '../icons';

type AuthSuccess = (token: string, username: string) => void;

export class Auth {
  el: HTMLElement;
  private api: Api;
  private onSuccess: AuthSuccess;

  private mode: 'login' | 'register' = 'login';
  private formTitleEl: HTMLElement;
  private submitBtn: HTMLButtonElement;
  private switchBtn: HTMLButtonElement;
  private usernameInput: HTMLInputElement;
  private passwordInput: HTMLInputElement;
  private errorEl: HTMLElement;
  private isLoading = false;

  constructor(api: Api, onSuccess: AuthSuccess) {
    this.api = api;
    this.onSuccess = onSuccess;

    this.formTitleEl = el('h2.auth__form-title', 'Вход');
    this.errorEl = el('div.auth__error');
    this.errorEl.style.display = 'none';

    this.usernameInput = el('input.auth__input', {
      type: 'text',
      placeholder: 'Имя пользователя',
      autocomplete: 'username',
    }) as HTMLInputElement;

    this.passwordInput = el('input.auth__input', {
      type: 'password',
      placeholder: 'Пароль',
      autocomplete: 'current-password',
    }) as HTMLInputElement;

    this.submitBtn = el('button.auth__submit', { type: 'submit' }, 'Войти') as HTMLButtonElement;
    this.switchBtn = el('button.auth__switch-btn', { type: 'button' }) as HTMLButtonElement;
    this.updateSwitchBtn();

    this.switchBtn.addEventListener('click', () => {
      this.mode = this.mode === 'login' ? 'register' : 'login';
      this.updateMode();
    });

    const form = el('form.auth__form', {
      onsubmit: (e: Event) => {
        e.preventDefault();
        void this.submit();
      },
    },
      this.formTitleEl,
      this.errorEl,
      this.usernameInput,
      this.passwordInput,
      this.submitBtn,
      el('div.auth__switch', this.switchBtn),
    );

    this.el = el('div.auth',
      el('div.auth__card',
        el('div.auth__logo',
          el('span.auth__logo-icon', { innerHTML: icons.musicNote }),
          el('span.auth__logo-text', 'VibeCast Studio'),
        ),
        form,
      ),
    );
  }

  private updateSwitchBtn(): void {
    this.switchBtn.textContent = this.mode === 'login'
      ? 'Нет аккаунта? Зарегистрируйтесь'
      : 'Уже есть аккаунт? Войдите';
  }

  private updateMode(): void {
    this.formTitleEl.textContent = this.mode === 'login' ? 'Вход' : 'Регистрация';
    this.submitBtn.textContent = this.mode === 'login' ? 'Войти' : 'Зарегистрироваться';
    this.passwordInput.setAttribute('autocomplete', this.mode === 'login' ? 'current-password' : 'new-password');
    this.updateSwitchBtn();
    this.hideError();
  }

  private showError(message: string): void {
    this.errorEl.textContent = message;
    this.errorEl.style.display = 'block';
  }

  private hideError(): void {
    this.errorEl.style.display = 'none';
  }

  private setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.submitBtn.disabled = loading;
    this.submitBtn.textContent = loading
      ? 'Подождите...'
      : (this.mode === 'login' ? 'Войти' : 'Зарегистрироваться');
  }

  private async submit(): Promise<void> {
    if (this.isLoading) return;

    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value;

    if (!username || !password) {
      this.showError('Заполните имя пользователя и пароль');
      return;
    }

    this.hideError();
    this.setLoading(true);

    try {
      if (this.mode === 'login') {
        const res = await this.api.login(username, password);
        this.onSuccess(res.token, username);
      } else {
        await this.api.register(username, password);
        const res = await this.api.login(username, password);
        this.onSuccess(res.token, username);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const errTyped = err as ApiError;
        this.showError(errTyped.status === 401 && this.mode === 'login'
          ? 'Неверное имя пользователя или пароль'
          : errTyped.message);
      } else {
        this.showError('Не удалось подключиться к серверу. Проверьте, что бэкенд запущен на порту 8000.');
      }
    } finally {
      this.setLoading(false);
    }
  }
}
