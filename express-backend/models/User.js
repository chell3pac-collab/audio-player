const users = [];
const favorites = {};

const AVATAR_MAX_CHARS = 400000; // ~300 КБ base64
const PROFILE_KEYS = ["displayName", "email", "bio", "avatar"];

const User = {
  create: (username, password) => {
    const user = {
      username, password,
      displayName: null, email: null, bio: null, avatar: null,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    favorites[username] = [];
    return user;
  },
  find: (username) => users.find((user) => user.username === username),
  getProfile: (username) => {
    const user = User.find(username);
    if (!user) return null;
    return {
      username: user.username, displayName: user.displayName,
      email: user.email, bio: user.bio, avatar: user.avatar,
      createdAt: user.createdAt,
    };
  },
  updateProfile: (username, data) => {
    const user = User.find(username);
    if (!user || !data) return null;
    PROFILE_KEYS.forEach((key) => {
      if (data[key] === undefined) return;
      if (key === "avatar" && typeof data[key] === "string" && data[key].length > AVATAR_MAX_CHARS) return;
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

module.exports = User;
