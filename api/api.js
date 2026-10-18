const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET_KEY = 'your_secret_key';
const DB_PATH = path.join('/tmp', 'vibecast-users.json');
const MAX_BODY = 2 * 1024 * 1024;
const MAX_AVATAR_CHARS = 400000; 
const SOUNDHELIX_SONGS = 17;

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function signJWT(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', SECRET_KEY).update(header + '.' + body).digest());
  return header + '.' + body + '.' + sig;
}

function verifyJWT(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = b64url(crypto.createHmac('sha256', SECRET_KEY).update(header + '.' + body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8'));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return salt + ':' + hash;
}

function checkPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 32).toString('hex');
  const a = Buffer.from(candidate);
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const users = [];
const favorites = {}; 

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      users.length = 0;
      (data.users || []).forEach((u) => users.push(u));
      Object.keys(favorites).forEach((k) => delete favorites[k]);
      Object.assign(favorites, data.favorites || {});
    }
  } catch { }
}

function save() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users, favorites }));
  } catch { }
}

const PROFILE_KEYS = ['displayName', 'email', 'bio', 'avatar'];

const User = {
  create: (username, password) => {
    const user = { username, password, displayName: null, email: null, bio: null, avatar: null, createdAt: new Date().toISOString() };
    users.push(user);
    favorites[username] = [];
    return user;
  },
  find: (username) => users.find((u) => u.username === username),
  getProfile: (username) => {
    const user = User.find(username);
    if (!user) return null;
    return { username: user.username, displayName: user.displayName, email: user.email, bio: user.bio, avatar: user.avatar, createdAt: user.createdAt };
  },
  updateProfile: (username, data) => {
    const user = User.find(username);
    if (!user || !data) return null;
    PROFILE_KEYS.forEach((key) => {
      if (data[key] === undefined) return;
      if (key === 'avatar' && typeof data[key] === 'string' && data[key].length > MAX_AVATAR_CHARS) return;
      user[key] = data[key];
    });
    return User.getProfile(username);
  },
  addFavorite: (username, trackId) => {
    if (!favorites[username]) favorites[username] = [];
    if (!favorites[username].includes(trackId)) favorites[username].push(trackId);
  },
  removeFavorite: (username, trackId) => {
    const list = favorites[username];
    if (!list) return;
    const index = list.indexOf(trackId);
    if (index > -1) list.splice(index, 1);
  },
  getFavorites: (username) => favorites[username] || [],
};

const tracks = [
  { id: 1, title: "Eternal Sunset", artist: "Skyline Sounds", album: "Morning Light", addedAt: "2026-10-01", duration: 9.36, size_mb: 8.57, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRXRlcm5hbCBTdW5zZXQgYnkgU2t5bGluZSBTb3VuZHM=" },
  { id: 2, title: "City Nights", artist: "Urban Beats", album: "City Horizon", addedAt: "2026-09-30", duration: 4.24, size_mb: 3.88, encoded_audio: "QXVkaW8gZGF0YSBmb3IgQ2l0eSBOaWdodHMgYnkgVXJiYW4gQmVhdHM=" },
  { id: 3, title: "Ocean Breeze", artist: "Deep Wave", album: "Deep Waters", addedAt: "2026-09-29", duration: 3.93, size_mb: 3.6, encoded_audio: "QXVkaW8gZGF0YSBmb3IgT2NlYW4gQnJlZXplIGJ5IERlcGggV2F2ZQ==" },
  { id: 4, title: "Morning Dew", artist: "Fresh Air", album: "Night Drive", addedAt: "2026-09-28", duration: 8.47, size_mb: 7.75, encoded_audio: "QXVkaW8gZGF0YSBmb3IgTW9ybmluZyBEZXcgYnkgRnJlc2ggQWly" },
  { id: 5, title: "Starlit Road", artist: "Cosmic Rhythms", album: "Skybound", addedAt: "2026-09-27", duration: 2.2, size_mb: 2.01, encoded_audio: "QXVkaW8gZGF0YSBmb3IgU3RhcmxpdCBSb2FkIGJ5IENvc21pYyBSaHl0aG1z" },
  { id: 6, title: "Midnight Escape", artist: "Nightfall", album: "Echoes", addedAt: "2026-10-01", duration: 5.23, size_mb: 4.77, encoded_audio: "QXVkaW8gZGF0YSBmb3IgTWlkbmlnaHQgRXNjYXBlIGJ5IE5pZ2h0ZmFsbA==" },
  { id: 7, title: "Electric Heart", artist: "Volt Sparks", album: "Momentum", addedAt: "2026-09-30", duration: 6.85, size_mb: 6.33, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRWxlY3RyaWMgSGVhcnQgYnkgVm9sdCBTcGFya3M=" },
  { id: 8, title: "Sunrise Over The City", artist: "Dawn Architects", album: "Northern Sky", addedAt: "2026-09-29", duration: 4.96, size_mb: 4.57, encoded_audio: "QXVkaW8gZGF0YSBmb3IgU3VucmlzZSBPdmVyIFRoZSBDaXR5IGJ5IERhd24gQXJjaGl0ZWN0cw==" },
  { id: 9, title: "Lost in the Echo", artist: "Wave Form", album: "Afterglow", addedAt: "2026-09-28", duration: 7.56, size_mb: 6.98, encoded_audio: "QXVkaW8gZGF0YSBmb3IgTG9zdCBpbiB0aGUgRWNobyBieSBXYXZlIEZvcm0=" },
  { id: 10, title: "Neon Pulse", artist: "Urban Vibes", album: "Driftwood", addedAt: "2026-09-27", duration: 3.87, size_mb: 3.54, encoded_audio: "QXVkaW8gZGF0YSBmb3IgTmVvbiBQdWxzZSBieSBVcmJhbiBWaWJlcyBv" },
  { id: 11, title: "Underwater Dreams", artist: "Aqua Groove", album: "Pulse", addedAt: "2026-10-01", duration: 6.62, size_mb: 6.09, encoded_audio: "QXVkaW8gZGF0YSBmb3IgVW5kZXJ3YXRlciBEcmVhbXMgYnkgQXF1YSBHcm92ZQ==" },
  { id: 12, title: "Desert Mirage", artist: "Sahara Beats", album: "Silver Lining", addedAt: "2026-09-30", duration: 4.77, size_mb: 4.38, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRGVzZXJ0IE1pcmFnZSBieSBTYWhhcmEgQmVhdHM=" },
  { id: 13, title: "Night Sky", artist: "Celestial Sounds", album: "Morning Light", addedAt: "2026-09-29", duration: 3.94, size_mb: 3.61, encoded_audio: "QXVkaW8gZGF0YSBmb3IgTmlnaHQgU2t5IGJ5IENlbGVzdGlhbCBTb3VuZHM=" },
  { id: 14, title: "Horizon Shift", artist: "Future Horizons", album: "City Horizon", addedAt: "2026-09-28", duration: 7.33, size_mb: 6.74, encoded_audio: "QXVkaW8gZGF0YSBmb3IgSG9yaXpvbiBTaGlmdCBieSBGdXR1cmUgSG9yaXpvbnM=" },
  { id: 15, title: "Echoes of the Past", artist: "Timeless Waves", album: "Deep Waters", addedAt: "2026-09-27", duration: 5.64, size_mb: 5.16, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRWNob2VzIG9mIHRoZSBQYXN0IGJ5IFRpbWVsZXNzIFdhdmU=" },
  { id: 16, title: "Rising Tide", artist: "Ocean Flow", album: "Night Drive", addedAt: "2026-10-01", duration: 6.41, size_mb: 5.88, encoded_audio: "QXVkaW8gZGF0YSBmb3IgUmlzaW5nIFRpZGUgYnkgT2NlYW4gRmxvdyBGb3c=" },
  { id: 17, title: "Blue Horizon", artist: "Sky Coast", album: "Skybound", addedAt: "2026-09-30", duration: 8.15, size_mb: 7.47, encoded_audio: "QXVkaW8gZGF0YSBmb3IgQmx1ZSBIb3Jpem9uIHN0cnVjdHVyZWQgYnk9U2t5IENvYXN0" },
  { id: 18, title: "Northern Lights", artist: "Aurora Dream", album: "Echoes", addedAt: "2026-09-29", duration: 6.94, size_mb: 6.39, encoded_audio: "QXVkaW8gZGF0YSBmb3IgTm9ydGhlcm4gTGlnaHRzIGJ5IEF1cm9yYSBEcmVhbQ==" },
  { id: 19, title: "Silent Night", artist: "Solitude Beats", album: "Momentum", addedAt: "2026-09-28", duration: 4.48, size_mb: 4.13, encoded_audio: "QXVkaW8gZGF0YSBmb3IgU2lsZW50IE5pZ2h0IGJ5IFNvbHV0aWRlIEJlYXRz" },
  { id: 20, title: "Moonlit Journey", artist: "Lunar Orchestra", album: "Northern Sky", addedAt: "2026-09-27", duration: 9.23, size_mb: 8.44, encoded_audio: "QXVkaW8gZGF0YSBmb3IgTW9vbmxpdCBKdXJuZXkgaW4gY29uY3VzdGFuY2UsIGJ5IEx1bmFyIFJ5dGhtcyBvYg==" },
  { id: 21, title: "Frozen Moments", artist: "Ice Queen", album: "Afterglow", addedAt: "2026-10-01", duration: 4.03, size_mb: 3.71, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRnJvemVuIE1vbWVudHMgYnkgSWNlIFF1ZWVu" },
  { id: 22, title: "Violet Sky", artist: "Dusk Echo", album: "Driftwood", addedAt: "2026-09-30", duration: 7.29, size_mb: 6.73, encoded_audio: "QXVkaW8gZGF0YSBmb3IgVmlvbGV0IFNreSBieSBKdXNrIEVjaG8gU2Vhc29ucw==" },
  { id: 23, title: "Waves of Change", artist: "Fluid Motion", album: "Pulse", addedAt: "2026-09-29", duration: 6.75, size_mb: 6.17, encoded_audio: "QXVkaW8gZGF0YSBmb3IgV2F2ZXMgb2YgQ2hhbmdlIGJ5IEZsdWlkIE1vdGlvbg==" },
  { id: 24, title: "Crystal Lake", artist: "Nature Spirits", album: "Silver Lining", addedAt: "2026-09-28", duration: 5.49, size_mb: 5.05, encoded_audio: "QXVkaW8gZGF0YSBmb3IgQ3lzdGFsIExha2UgYnkgTmF0dXJlIFNwaXJpdHM=" },
  { id: 25, title: "Timeless Moment", artist: "Vintage Rhythms", album: "Morning Light", addedAt: "2026-09-27", duration: 7.64, size_mb: 7.02, encoded_audio: "QXVkaW8gZGF0YSBmb3IgVGltZWxlc3MgTW9tZW50IGJ5IFZpbnRhZ2UgUnl0aG1z" },
  { id: 26, title: "Galaxy's Edge", artist: "Stellar Frequencies", album: "City Horizon", addedAt: "2026-10-01", duration: 8.28, size_mb: 7.64, encoded_audio: "QXVkaW8gZGF0YSBmb3IgR2FsYWFyeSBFZGdlIGJ5IFN0ZWxsYXIgRnJlcXVlbmNpZXM=" },
  { id: 27, title: "Infinite Dreams", artist: "Endless Journey", album: "Deep Waters", addedAt: "2026-09-30", duration: 6.52, size_mb: 5.99, encoded_audio: "QXVkaW8gZGF0YSBmb3IgSW5maW5pdGUgRHJlYW1zIGJ5IEVuZGxlc3MgSnVybmV5" },
  { id: 28, title: "Solar Flare", artist: "Heatwave", album: "Night Drive", addedAt: "2026-09-29", duration: 5.89, size_mb: 5.42, encoded_audio: "QXVkaW8gZGF0YSBmb3IgU29sYXIgRmxhcmUgYnkgSGVhdHdhdmU=" },
  { id: 29, title: "Into the Wilderness", artist: "Wild Roots", album: "Skybound", addedAt: "2026-09-28", duration: 4.21, size_mb: 3.88, encoded_audio: "QXVkaW8gZGF0YSBmb3IgSW50byB0aGUgV2lsZGVybmVzcyBieSBXaWxkIFJvb3Rz" },
  { id: 30, title: "Echo in the Mountains", artist: "Alpine Voice", album: "Echoes", addedAt: "2026-09-27", duration: 8.14, size_mb: 7.46, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRWNobyBpbiB0aGUgTW91bnRhaW5zIGJ5IEFscGluZSBWb2ljZQ==" },
  { id: 31, title: "Morning Mist", artist: "Cloudrise", album: "Momentum", addedAt: "2026-10-01", duration: 6.47, size_mb: 5.95, encoded_audio: "QXVkaW8gZGF0YSBmb3IgTW9ybmluZyBNaXN0IGJ5IENsb3VkcmlzZQ==" },
  { id: 32, title: "Chasing the Moon", artist: "Lunar Run", album: "Northern Sky", addedAt: "2026-09-30", duration: 4.92, size_mb: 4.5, encoded_audio: "QXVkaW8gZGF0YSBmb3IgQ2hhc2luZyB0aGUgTW9vbiBieSBMdW5hciBSdW4=" },
  { id: 33, title: "Whispers of the Forest", artist: "Green Echoes", album: "Afterglow", addedAt: "2026-09-29", duration: 7.02, size_mb: 6.44, encoded_audio: "QXVkaW8gZGF0YSBmb3IgV2hpcHNlcnMgb2YgdGhlIEZvcmVzdCBieSBHcmVlbiBFY2hvZXM=" },
  { id: 34, title: "Crimson Sunset", artist: "Red Sky", album: "Driftwood", addedAt: "2026-09-28", duration: 5.8, size_mb: 5.33, encoded_audio: "QXVkaW8gZGF0YSBmb3IgQ3JpbXNvbiBTdW5zZXQgYnkgUmVkIFNreQ==" },
  { id: 35, title: "Digital Dreams", artist: "Techno Pulse", album: "Pulse", addedAt: "2026-09-27", duration: 6.33, size_mb: 5.9, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRGlnaXRhbCBkcmVhbXMgYnkgVGVjaG5vIFB1bHNl" },
  { id: 36, title: "Gravity Waves", artist: "Planetary Sound", album: "Silver Lining", addedAt: "2026-10-01", duration: 7.15, size_mb: 6.56, encoded_audio: "QXVkaW8gZGF0YSBmb3IgR3Jhdml0eSBXYXZlcyBieSBQbGFuZXRhcnkgU291bmQ=" },
  { id: 37, title: "Electric Dreams", artist: "Neon Flux", album: "Morning Light", addedAt: "2026-09-30", duration: 5.91, size_mb: 5.46, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRWxlY3RyaWMgRHJlYW1zIGJ5IE5lb24gRmx1eA==" },
  { id: 38, title: "Wind in the Pines", artist: "Whispering Winds", album: "City Horizon", addedAt: "2026-09-29", duration: 7.67, size_mb: 7.05, encoded_audio: "QXVkaW8gZGF0YSBmb3IgV2luZCBpbiB0aGUgUGluZXMgYnkgV2hpc3BlcmluZyBXYWluZHM=" },
  { id: 39, title: "Silent Sea", artist: "Blue Horizon", album: "Deep Waters", addedAt: "2026-09-28", duration: 6.0, size_mb: 5.5, encoded_audio: "QXVkaW8gZGF0YSBmb3IgU2lsZW50IFNlYSBieSBQbHVlIEhvcnpvem9u" },
  { id: 40, title: "Autumn Breeze", artist: "Harvest Song", album: "Night Drive", addedAt: "2026-09-27", duration: 8.1, size_mb: 7.42, encoded_audio: "QXVkaW8gZGF0YSBmb3IgQXV0dW0gYnJlZXplIGJ5IEhhcnZlc3QgU29uZw==" },
  { id: 41, title: "Falling Stars", artist: "Cosmic Voyagers", album: "Skybound", addedAt: "2026-10-01", duration: 6.25, size_mb: 5.75, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRmFsbGluZyBTdGFycyBieSBDb3NtYWMgVm95YWdlcnM=" },
  { id: 42, title: "Nightfall", artist: "The Dark Knights", album: "Echoes", addedAt: "2026-09-30", duration: 7.52, size_mb: 6.92, encoded_audio: "QXVkaW8gZGF0YSBmb3IgTmlnaHRmYWxsIGJ5IFRoZSBEYXJkIEtuaWdodHM=" },
  { id: 43, title: "Deep Blue", artist: "Aqua Beat", album: "Momentum", addedAt: "2026-09-29", duration: 6.82, size_mb: 6.26, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRGVlcCBCbHVlIGJ5IEFxdWEgQmVhdA==" },
  { id: 44, title: "Melancholy Dream", artist: "Dream State", album: "Northern Sky", addedAt: "2026-09-28", duration: 5.92, size_mb: 5.48, encoded_audio: "QXVkaW8gZGF0YSBmb3IgTWVsYW5jaG9seSBkcmVhbSBieSBkcmVhbSBzdGF0ZQ==" },
  { id: 45, title: "Golden Hour", artist: "Sunset Sounds", album: "Afterglow", addedAt: "2026-09-27", duration: 7.35, size_mb: 6.76, encoded_audio: "QXVkaW8gZGF0YSBmb3IgR29sZGVuIEhvdXIgYnkgU3Vuc2V0IFNvdW5kcw==" },
  { id: 46, title: "Distant Echoes", artist: "Faraway Rhythm", album: "Driftwood", addedAt: "2026-10-01", duration: 6.51, size_mb: 5.99, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRGlzdGFudCBFY2hvZXMgb2YgRmFyd2F5IFJ5dGht" },
  { id: 47, title: "Winter Solstice", artist: "Chillwave", album: "Pulse", addedAt: "2026-09-30", duration: 8.33, size_mb: 7.65, encoded_audio: "QXVkaW8gZGF0YSBmb3IgV2ludGVyIFNvbHN0aWNlIGJ5IENoaWxsd2F2ZQ==" },
  { id: 48, title: "Electric Skies", artist: "Future Electro", album: "Silver Lining", addedAt: "2026-09-29", duration: 7.88, size_mb: 7.23, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRWxlY3RyaWMgU2tpZXMgYnkgRnV0dXJlIEVsZWN0cm8=" },
  { id: 49, title: "Lost Time", artist: "Retro Wave", album: "Morning Light", addedAt: "2026-09-28", duration: 6.12, size_mb: 5.64, encoded_audio: "QXVkaW8gZGF0YSBmb3IgTG9zdCBUaW1lIGJ5IFJldHJvIFdhdmU=" },
  { id: 50, title: "Firefly Lights", artist: "Night Dreams", album: "City Horizon", addedAt: "2026-09-27", duration: 5.72, size_mb: 5.26, encoded_audio: "QXVkaW8gZGF0YSBmb3IgRmlyZWZseSBMaWdodHMgYnkgTmlnaHQgRHJlYW1z" },
];

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function authenticate(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: { status: 403, body: { message: 'доступ запрещен' } } };
  const decoded = verifyJWT(token);
  if (!decoded || !decoded.username) return { error: { status: 400, body: { message: 'токен некорректный' } } };
  return { user: decoded };
}

function validateProfile(data) {
  if (data.displayName !== undefined && data.displayName !== null &&
      (typeof data.displayName !== 'string' || data.displayName.trim().length > 50)) {
    return { status: 400, body: { message: 'имя не должно превышать 50 символов' } };
  }
  if (data.email !== undefined && data.email !== null) {
    const trimmed = typeof data.email === 'string' ? data.email.trim() : null;
    if (trimmed === null || trimmed.length > 100 ||
        (trimmed !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))) {
      return { status: 400, body: { message: 'некорректный email' } };
    }
  }
  if (data.bio !== undefined && data.bio !== null &&
      (typeof data.bio !== 'string' || data.bio.trim().length > 300)) {
    return { status: 400, body: { message: 'описание не должно превышать 300 символов' } };
  }
  if (data.avatar !== undefined && data.avatar !== null) {
    const ok = typeof data.avatar === 'string' &&
      (data.avatar === '' || (data.avatar.startsWith('data:image/') && data.avatar.length <= MAX_AVATAR_CHARS));
    if (!ok) return { status: 400, body: { message: 'некорректное изображение (до 300 КБ)' } };
  }
  return null;
}

async function route(req, res, path) {
  const method = req.method;

  if (path === 'register' && method === 'POST') {
    const { username, password } = req.body || {};
    if (User.find(username)) return json(res, 400, { message: 'пользователь уже существует' });
    const newUser = User.create(username, hashPassword(password));
    save();
    return json(res, 201, { message: 'пользователь успешно добавлен', user: { username: newUser.username } });
  }

  if (path === 'login' && method === 'POST') {
    const { username, password } = req.body || {};
    const user = User.find(username);
    if (!user || !checkPassword(password, user.password)) {
      return json(res, 400, { message: 'произошла ошибка при авторизации - неверные данные' });
    }
    const token = signJWT({ username, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 });
    return json(res, 200, { message: 'авторизация прошла успешно', token });
  }

  if (path === 'tracks' && method === 'GET') {
    return json(res, 200, tracks);
  }

  const m = path.match(/^tracks\/(\d+)\/audio$/) || path.match(/^audio\/(\d+)\.mp3$/);
  if (m) {
    const songIndex = ((Number(m[1]) - 1) % SOUNDHELIX_SONGS) + 1;
    res.statusCode = 302;
    res.setHeader('Location', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-' + songIndex + '.mp3');
    return res.end();
  }

  const auth = authenticate(req);
  const protectedRoute = path === 'profile' || path === 'favorites';
  if (auth.error && protectedRoute) {
    return json(res, auth.error.status, auth.error.body);
  }
  if (!auth.error) {
    const username = auth.user.username;

    if (path === 'profile' && method === 'GET') {
      const profile = User.getProfile(username);
      if (!profile) return json(res, 404, { message: 'пользователь не найден' });
      return json(res, 200, profile);
    }

    if (path === 'profile' && method === 'PUT') {
      if (!User.find(username)) return json(res, 404, { message: 'пользователь не найден' });
      const invalid = validateProfile(req.body || {});
      if (invalid) return json(res, invalid.status, invalid.body);
      const updated = User.updateProfile(username, req.body || {});
      if (!updated) return json(res, 404, { message: 'пользователь не найден' });
      save();
      return json(res, 200, updated);
    }

    if (path === 'favorites' && method === 'POST') {
      const { trackId } = req.body || {};
      User.addFavorite(username, trackId);
      save();
      return json(res, 200, { message: 'композиция добавлена в избранное' });
    }

    if (path === 'favorites' && method === 'DELETE') {
      const { trackId } = req.body || {};
      User.removeFavorite(username, trackId);
      save();
      return json(res, 200, { message: 'композиция убрана из избранного' });
    }

    if (path === 'favorites' && method === 'GET') {
      const fav = User.getFavorites(username);
      const details = tracks.filter((t) => fav.map(String).includes(String(t.id)));
      return json(res, 200, details);
    }
  }

  return json(res, 404, { message: 'Not Found' });
}

module.exports = async (req, res) => {
  load();
  const url = new URL(req.url, 'http://localhost');
  const target = url.searchParams.get('path') || '';
  let body = {};
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    await new Promise((resolve) => {
      req.on('data', (chunk) => {
        chunks.push(chunk);
        if (Buffer.concat(chunks).length > MAX_BODY) req.destroy();
      });
      req.on('end', resolve);
      req.on('error', resolve);
    });
    if (chunks.length) {
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { body = {}; }
    }
  }
  req.body = body;
  return route(req, res, target);
};