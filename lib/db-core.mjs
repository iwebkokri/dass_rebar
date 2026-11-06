// Database core — shared by the Next.js app (lib/db.ts) and the CLI scripts (scripts/*.mjs).
//
// Uses Node's built-in SQLite (node:sqlite, Node >= 22.13), so there is no native module to
// compile on the server. The whole database is ONE file: copy it to move the site's content.
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/** Folder holding the database and uploaded files. Override with DATA_DIR (e.g. a folder outside the app root). */
export function getDataDir() {
  // (the turbopackIgnore comment stops the bundler tracing the whole project into the server build)
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(process.cwd(), 'data'));
}

export function getDatabasePath() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH || path.join(getDataDir(), 'dassrebar.db'));
}

// Each entry migrates the database from version N to N+1 (tracked with PRAGMA user_version).
const MIGRATIONS = [
  /* 1 — initial schema */
  `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);

  CREATE TABLE rate_limits (
    key      TEXT PRIMARY KEY,
    count    INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  );

  CREATE TABLE posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    slug         TEXT NOT NULL UNIQUE,
    title        TEXT NOT NULL,
    category     TEXT NOT NULL DEFAULT '',
    excerpt      TEXT NOT NULL DEFAULT '',
    body         TEXT NOT NULL DEFAULT '',
    cover_image  TEXT NOT NULL DEFAULT '',
    external_url TEXT NOT NULL DEFAULT '',
    published_at TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
    featured     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_posts_published ON posts(status, published_at DESC);

  CREATE TABLE projects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT NOT NULL UNIQUE,
    title      TEXT NOT NULL,
    category   TEXT NOT NULL DEFAULT '',
    location   TEXT NOT NULL DEFAULT '',
    address    TEXT NOT NULL DEFAULT '',
    images     TEXT NOT NULL DEFAULT '[]',
    featured   INTEGER NOT NULL DEFAULT 0,
    roster     INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    published  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT NOT NULL DEFAULT 'stocked' CHECK (kind IN ('stocked','also')),
    name        TEXT NOT NULL,
    sizes       TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    image       TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    published   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE bar_data (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    bar_size            TEXT NOT NULL,
    mass_kg_m           REAL NOT NULL,
    nominal_diameter_mm REAL NOT NULL,
    area_mm2            REAL NOT NULL,
    perimeter_mm        REAL NOT NULL,
    on_request          INTEGER NOT NULL DEFAULT 0,
    sort_order          INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE submissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL CHECK (type IN ('contact','quote','calculator','newsletter')),
    name        TEXT NOT NULL DEFAULT '',
    email       TEXT NOT NULL DEFAULT '',
    phone       TEXT NOT NULL DEFAULT '',
    company     TEXT NOT NULL DEFAULT '',
    message     TEXT NOT NULL DEFAULT '',
    data        TEXT NOT NULL DEFAULT '{}',
    attachments TEXT NOT NULL DEFAULT '[]',
    status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','archived')),
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_submissions_created ON submissions(created_at DESC);
  CREATE INDEX idx_submissions_status ON submissions(status, type);
  `,

  /* 2 — page builder, media library, menus, forms, comments, taxonomy, redirects, roles, activity */
  `
  ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'administrator';
  ALTER TABLE users ADD COLUMN last_login_at TEXT;

  -- posts: allow 'trash', add author / comments toggle / SEO fields (CHECK constraints can't be altered, so rebuild)
  CREATE TABLE posts_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT '',
    excerpt         TEXT NOT NULL DEFAULT '',
    body            TEXT NOT NULL DEFAULT '',
    cover_image     TEXT NOT NULL DEFAULT '',
    external_url    TEXT NOT NULL DEFAULT '',
    published_at    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','trash')),
    featured        INTEGER NOT NULL DEFAULT 0,
    author_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    comments_enabled INTEGER NOT NULL DEFAULT 1,
    seo_title       TEXT NOT NULL DEFAULT '',
    seo_description TEXT NOT NULL DEFAULT '',
    og_image        TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT INTO posts_new (id, slug, title, category, excerpt, body, cover_image, external_url, published_at, status, featured, created_at, updated_at)
    SELECT id, slug, title, category, excerpt, body, cover_image, external_url, published_at, status, featured, created_at, updated_at FROM posts;
  DROP TABLE posts;
  ALTER TABLE posts_new RENAME TO posts;
  CREATE INDEX idx_posts_published ON posts(status, published_at DESC);

  -- submissions: type is free text now ('contact','quote','calculator','newsletter','form:<slug>')
  CREATE TABLE submissions_new (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    email       TEXT NOT NULL DEFAULT '',
    phone       TEXT NOT NULL DEFAULT '',
    company     TEXT NOT NULL DEFAULT '',
    message     TEXT NOT NULL DEFAULT '',
    data        TEXT NOT NULL DEFAULT '{}',
    attachments TEXT NOT NULL DEFAULT '[]',
    status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','archived')),
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT INTO submissions_new SELECT id, type, name, email, phone, company, message, data, attachments, status, notes, created_at FROM submissions;
  DROP TABLE submissions;
  ALTER TABLE submissions_new RENAME TO submissions;
  CREATE INDEX idx_submissions_created ON submissions(created_at DESC);
  CREATE INDEX idx_submissions_status ON submissions(status, type);

  -- pages: every public page is a builder document ('' = home, 'about', 'services/fabrication' …)
  CREATE TABLE pages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    path            TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','trash')),
    layout          TEXT NOT NULL DEFAULT 'default' CHECK (layout IN ('default','canvas')),
    content         TEXT NOT NULL DEFAULT '{"v":1,"nodes":[]}',
    seo_title       TEXT NOT NULL DEFAULT '',
    seo_description TEXT NOT NULL DEFAULT '',
    og_image        TEXT NOT NULL DEFAULT '',
    noindex         INTEGER NOT NULL DEFAULT 0,
    author_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    published_at    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_pages_status ON pages(status);

  -- templates: global header / footer, saved sections ("reusable blocks"), saved page layouts
  CREATE TABLE templates (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kind       TEXT NOT NULL CHECK (kind IN ('header','footer','section','page')),
    name       TEXT NOT NULL,
    content    TEXT NOT NULL DEFAULT '{"v":1,"nodes":[]}',
    active     INTEGER NOT NULL DEFAULT 0,
    author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- revisions of pages / templates / posts
  CREATE TABLE revisions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    entity     TEXT NOT NULL,
    entity_id  INTEGER NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_revisions_entity ON revisions(entity, entity_id, id DESC);

  -- media library. url is what pages store ('/uploads/2026/11/x.jpg' or '/images/x.jpg')
  CREATE TABLE media (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    url           TEXT NOT NULL UNIQUE,
    storage       TEXT NOT NULL DEFAULT 'upload' CHECK (storage IN ('upload','public')),
    filename      TEXT NOT NULL,
    original_name TEXT NOT NULL DEFAULT '',
    mime          TEXT NOT NULL DEFAULT '',
    kind          TEXT NOT NULL DEFAULT 'file' CHECK (kind IN ('image','video','audio','file')),
    size          INTEGER NOT NULL DEFAULT 0,
    width         INTEGER,
    height        INTEGER,
    alt           TEXT NOT NULL DEFAULT '',
    title         TEXT NOT NULL DEFAULT '',
    caption       TEXT NOT NULL DEFAULT '',
    folder        TEXT NOT NULL DEFAULT '',
    user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_media_kind ON media(kind, id DESC);

  -- menus: items is a JSON tree [{ id, label, url, description, newTab, children: [...] }]
  CREATE TABLE menus (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    items      TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- custom forms made in the CMS (fields: JSON array, settings: JSON object)
  CREATE TABLE forms (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    fields     TEXT NOT NULL DEFAULT '[]',
    settings   TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- categories & tags for posts
  CREATE TABLE terms (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    taxonomy    TEXT NOT NULL CHECK (taxonomy IN ('category','tag')),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    UNIQUE (taxonomy, slug)
  );
  CREATE TABLE post_terms (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, term_id)
  );

  CREATE TABLE comments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id      INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_id    INTEGER,
    author_name  TEXT NOT NULL,
    author_email TEXT NOT NULL DEFAULT '',
    body         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','spam','trash')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_comments_post ON comments(post_id, status);
  CREATE INDEX idx_comments_status ON comments(status, id DESC);

  CREATE TABLE redirects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    from_path  TEXT NOT NULL UNIQUE,
    to_url     TEXT NOT NULL,
    code       INTEGER NOT NULL DEFAULT 301 CHECK (code IN (301,302,307,308)),
    hits       INTEGER NOT NULL DEFAULT 0,
    enabled    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE activity (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    user_label TEXT NOT NULL DEFAULT '',
    action     TEXT NOT NULL,
    entity     TEXT NOT NULL DEFAULT '',
    entity_id  TEXT NOT NULL DEFAULT '',
    summary    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_activity_created ON activity(id DESC);
  `,
];

function loadSqlite() {
  const sqlite = process.getBuiltinModule?.('node:sqlite');
  if (!sqlite) {
    throw new Error(
      `This site needs Node.js 22.13 or newer (it uses the built-in SQLite). You are running ${process.version}. ` +
        'On Hostinger, pick Node 22 or 24 in the Node.js app settings.'
    );
  }
  return sqlite;
}

/** Open (and create / migrate if needed) the SQLite database. */
export function openDatabase(file = getDatabasePath()) {
  const { DatabaseSync } = loadSqlite();
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db) {
  let version = db.prepare('PRAGMA user_version').get().user_version;
  while (version < MIGRATIONS.length) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      version += 1;
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
