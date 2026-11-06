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

  /* 3 — SEO / AI tools: per-page and per-post search fields, page-level code, 404 monitor.
         Written as a function so every step checks what already exists first (additive + safe to re-run). */
  (db) => {
    const cols = (table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    const add = (table, name, ddl) => {
      if (!cols(table).has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
    };
    const text = "TEXT NOT NULL DEFAULT ''";
    const shared = {
      focus_keyword: text,
      canonical_url: text,
      nofollow: 'INTEGER NOT NULL DEFAULT 0',
      og_title: text,
      og_description: text,
      twitter_card: text,
      schema_type: text,
      answer_summary: text,
      breadcrumb_title: text,
      custom_jsonld: text,
    };
    for (const [name, ddl] of Object.entries(shared)) {
      add('pages', name, ddl);
      add('posts', name, ddl);
    }
    add('posts', 'noindex', 'INTEGER NOT NULL DEFAULT 0');
    // page-level code (administrators only): CSS, <head> code, code before </body>
    add('pages', 'code_css', text);
    add('pages', 'code_head', text);
    add('pages', 'code_footer', text);

    // 404 monitor: one row per missing path
    db.exec(`
      CREATE TABLE IF NOT EXISTS not_found_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        path       TEXT NOT NULL UNIQUE,
        hits       INTEGER NOT NULL DEFAULT 1,
        referrer   TEXT NOT NULL DEFAULT '',
        ignored    INTEGER NOT NULL DEFAULT 0,
        first_seen TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_not_found_seen ON not_found_log(ignored, last_seen DESC);
    `);
  },

  /* 4 — emailer + popups: mail_log (every email attempt), where a lead came from, and a 'popup' template kind with its settings.
         Independent of migration 3; every step checks what already exists first (additive + safe to re-run). */
  (db) => {
    const cols = (table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));

    // one row per email we tried to send; the body is rebuilt from the submission when retrying / resending
    db.exec(`
      CREATE TABLE IF NOT EXISTS mail_log (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id   INTEGER,
        kind            TEXT NOT NULL DEFAULT 'owner' CHECK (kind IN ('owner','autoreply','test')),
        to_addr         TEXT NOT NULL DEFAULT '',
        subject         TEXT NOT NULL DEFAULT '',
        status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
        error           TEXT NOT NULL DEFAULT '',
        attempts        INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at         TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_mail_log_created ON mail_log(id DESC);
      CREATE INDEX IF NOT EXISTS idx_mail_log_status ON mail_log(status, next_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_mail_log_submission ON mail_log(submission_id, kind);
    `);

    // which page (and popup) a submission came from
    if (!cols('submissions').has('source_url')) db.exec("ALTER TABLE submissions ADD COLUMN source_url TEXT NOT NULL DEFAULT ''");
    if (!cols('submissions').has('source_label')) db.exec("ALTER TABLE submissions ADD COLUMN source_label TEXT NOT NULL DEFAULT ''");

    // templates: allow kind 'popup' and give every template a settings blob (CHECK constraints can't be altered, so rebuild)
    const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'templates'").get()?.sql || '';
    if (!sql.includes("'popup'")) {
      db.exec(`
        CREATE TABLE templates_new (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          kind       TEXT NOT NULL CHECK (kind IN ('header','footer','section','page','popup')),
          name       TEXT NOT NULL,
          content    TEXT NOT NULL DEFAULT '{"v":1,"nodes":[]}',
          active     INTEGER NOT NULL DEFAULT 0,
          author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          settings   TEXT NOT NULL DEFAULT '{}'
        );
        INSERT INTO templates_new (id, kind, name, content, active, author_id, created_at, updated_at)
          SELECT id, kind, name, content, active, author_id, created_at, updated_at FROM templates;
        DROP TABLE templates;
        ALTER TABLE templates_new RENAME TO templates;
      `);
    } else if (!cols('templates').has('settings')) {
      db.exec("ALTER TABLE templates ADD COLUMN settings TEXT NOT NULL DEFAULT '{}'");
    }
  },

  /* 5 — Lead Manager forwarding: one log row per forwarded submission (UNIQUE so a lead can never be queued twice) and the
         first-touch attribution (utm_* + landing page + referrer) stored with each submission. Additive + safe to re-run. */
  (db) => {
    const cols = (table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    db.exec(`
      CREATE TABLE IF NOT EXISTS lead_forwards (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id   INTEGER UNIQUE,
        kind            TEXT NOT NULL DEFAULT 'lead' CHECK (kind IN ('lead','test')),
        external_id     TEXT NOT NULL DEFAULT '',
        form_name       TEXT NOT NULL DEFAULT '',
        status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','accepted','failed','skipped','refused')),
        reason          TEXT NOT NULL DEFAULT '',
        http_status     INTEGER,
        response        TEXT NOT NULL DEFAULT '',
        error           TEXT NOT NULL DEFAULT '',
        attempts        INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at         TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_lead_forwards_status ON lead_forwards(status, next_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_lead_forwards_created ON lead_forwards(id DESC);
    `);
    if (!cols('submissions').has('attribution')) db.exec("ALTER TABLE submissions ADD COLUMN attribution TEXT NOT NULL DEFAULT '{}'");
  },
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
      const step = MIGRATIONS[version];
      if (typeof step === 'function') step(db);
      else db.exec(step);
      version += 1;
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
