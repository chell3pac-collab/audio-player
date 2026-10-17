const User = require("../models/User");
const MAX_AVATAR_CHARS = 400000;

const getProfile = (req, res) => {
  const profile = User.getProfile(req.user.username);
  if (!profile) return res.status(404).json({ message: "пользователь не найден" });
  res.json(profile);
};

const updateProfile = (req, res) => {
  const username = req.user.username;
  if (!User.find(username)) return res.status(404).json({ message: "пользователь не найден" });

  const { displayName, email, bio, avatar } = req.body || {};

  if (displayName !== undefined && displayName !== null &&
      (typeof displayName !== "string" || displayName.trim().length > 50)) {
    return res.status(400).json({ message: "имя не должно превышать 50 символов" });
  }
  if (email !== undefined && email !== null) {
    const trimmed = typeof email === "string" ? email.trim() : null;
    if (trimmed === null || trimmed.length > 100 ||
        (trimmed !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))) {
      return res.status(400).json({ message: "некорректный email" });
    }
  }
  if (bio !== undefined && bio !== null &&
      (typeof bio !== "string" || bio.trim().length > 300)) {
    return res.status(400).json({ message: "описание не должно превышать 300 символов" });
  }
  if (avatar !== undefined && avatar !== null) {
    const ok = typeof avatar === "string" &&
      (avatar === "" || (avatar.startsWith("data:image/") && avatar.length <= MAX_AVATAR_CHARS));
    if (!ok) return res.status(400).json({ message: "некорректное изображение (до 300 КБ)" });
  }

  const updated = User.updateProfile(username, {
    displayName: displayName === undefined ? undefined : displayName,
    email: email === undefined ? undefined : email,
    bio: bio === undefined ? undefined : bio,
    avatar: avatar === undefined ? undefined : avatar,
  });
  if (!updated) return res.status(404).json({ message: "пользователь не найден" });
  res.json(updated);
};

module.exports = { getProfile, updateProfile };
