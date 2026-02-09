PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS screens (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('main-menu','drinks','events'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK(channel IN ('main-menu','drinks')),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Seed 3 screens if empty
INSERT OR IGNORE INTO screens (id, name, channel) VALUES
  (1, 'TV 1 - Main Menu', 'main-menu'),
  (2, 'TV 2 - Drinks', 'drinks'),
  (3, 'TV 3 - Events', 'events');
