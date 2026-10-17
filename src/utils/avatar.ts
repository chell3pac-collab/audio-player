// Загрузка и подготовка фото профиля: обрезаем по квадрату
// и сжимаем до 256x256, чтобы не гонять через API большие файлы.

const AVATAR_SIZE = 256;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Выберите файл изображения');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Файл слишком большой — до 10 МБ');
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return cropToSquare(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = src;
  });
}

function cropToSquare(img: HTMLImageElement): string {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas недоступен в этом браузере');
  }

  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  return canvas.toDataURL('image/jpeg', 0.85);
}
