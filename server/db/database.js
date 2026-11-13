import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pathian_ram.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys for performance
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  console.log('Initializing database schema...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'BIAL')),
      bial_name TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'locked')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT NOT NULL,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bial_id INTEGER NOT NULL,
      year INTEGER NOT NULL DEFAULT 2026,
      sl_no INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bial_id) REFERENCES bials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS month_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bial_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
      is_locked INTEGER DEFAULT 0 CHECK(is_locked IN (0, 1)),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(bial_id, year, month)
    );

    CREATE TABLE IF NOT EXISTS tithes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      bial_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
      pathian_ram REAL DEFAULT 0,
      ramthar REAL DEFAULT 0,
      tualchhung REAL DEFAULT 0,
      building REAL DEFAULT 0,
      total REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(member_id, year, month),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (bial_id) REFERENCES bials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS financial_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 0 CHECK(is_active IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tithe_columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      field_key TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#6366f1',
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate extra_amounts column on tithes if missing
  try {
    db.exec("ALTER TABLE tithes ADD COLUMN extra_amounts TEXT DEFAULT '{}';");
  } catch (e) {
    // Column already exists
  }

  // Migrate email and google_id columns on users if missing
  try {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE users ADD COLUMN google_id TEXT;");
  } catch (e) {}

  // Create admin_google_emails table if missing
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_google_emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.prepare("INSERT OR IGNORE INTO admin_google_emails (email) VALUES ('muantea45@gmail.com'), ('sakadarkim@gmail.com');").run();
  } catch (e) {}

  // Seed default tithe columns if empty
  try {
    const colCheck = db.prepare('SELECT COUNT(*) as count FROM tithe_columns').get();
    if (colCheck.count === 0) {
      const defaultCols = [
        { name: 'Pathian Ram', code: 'PTR', field_key: 'pathian_ram', color: '#6366f1', display_order: 1 },
        { name: 'Ramthar', code: 'RT', field_key: 'ramthar', color: '#10b981', display_order: 2 },
        { name: 'Tualchhung', code: 'Tch', field_key: 'tualchhung', color: '#f59e0b', display_order: 3 },
        { name: 'Building', code: 'Bldg', field_key: 'building', color: '#a855f7', display_order: 4 }
      ];
      const stmt = db.prepare('INSERT INTO tithe_columns (name, code, field_key, color, display_order) VALUES (?, ?, ?, ?, ?)');
      for (const c of defaultCols) {
        stmt.run(c.name, c.code, c.field_key, c.color, c.display_order);
      }
    }
  } catch (e) {
    // ignore
  }

  // Migrate year column in members table if missing
  try {
    db.exec('ALTER TABLE members ADD COLUMN year INTEGER DEFAULT 2026;');
  } catch (e) {
    // Column already exists
  }

  // Backfill existing NULL years to 2026
  try {
    db.exec('UPDATE members SET year = 2026 WHERE year IS NULL;');
  } catch (e) {
    // ignore
  }

  // Migrate is_active column if missing
  try {
    db.exec('ALTER TABLE financial_years ADD COLUMN is_active INTEGER DEFAULT 0;');
  } catch (e) {
    // Column already exists
  }

  // Seed default financial years if empty
  const yearCheck = db.prepare('SELECT COUNT(*) as count FROM financial_years').get();
  if (yearCheck.count === 0) {
    const defaultYears = [2024, 2025, 2026, 2027];
    const stmt = db.prepare('INSERT INTO financial_years (year, is_active) VALUES (?, ?)');
    for (const y of defaultYears) {
      stmt.run(y, y === 2026 ? 1 : 0);
    }
  } else {
    // Ensure at least one active year
    const activeCheck = db.prepare('SELECT id FROM financial_years WHERE is_active = 1 LIMIT 1').get();
    if (!activeCheck) {
      const latestYear = db.prepare('SELECT id FROM financial_years ORDER BY year DESC LIMIT 1').get();
      if (latestYear) {
        db.prepare('UPDATE financial_years SET is_active = 1 WHERE id = ?').run(latestYear.id);
      }
    }
  }

  // Create default Admin account if no users exist
  const adminCheck = db.prepare("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1").get();
  if (!adminCheck) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'ADMIN');
    console.log('Default Admin created: username = "admin", password = "admin123"');
  }

  // Create default official 12 Bials and members if empty
  const bialCheck = db.prepare('SELECT COUNT(*) as count FROM bials').get();
  if (bialCheck.count === 0) {
    console.log('Seeding initial 12 Bials, 144 members, and FY2026 contributions...');
    const bialsList = [
      { name: 'Pu Lalengzama', code: 'B1', username: 'bial1' },
      { name: 'Tv. VL Hmangaihzuala', code: 'B2', username: 'bial2' },
      { name: 'Pu F. Zodinpuia', code: 'B3', username: 'bial3' },
      { name: 'Pu Joseph Laldanmawia', code: 'B4', username: 'bial4' },
      { name: 'Pu F. Remmawia', code: 'B5', username: 'bial5' },
      { name: 'Pu F. Vanlalzauva', code: 'B6', username: 'bial6' },
      { name: 'Pu PC Lalrindika', code: 'B7', username: 'bial7' },
      { name: 'Pu FC Vanlalngaia', code: 'B8', username: 'bial8' },
      { name: 'Pu Vanlalvena Pachuau', code: 'B9', username: 'bial9' },
      { name: 'Pu HL Sangpuia', code: 'B10', username: 'bial10' },
      { name: 'Pu F. Lalchhuankima', code: 'B11', username: 'bial11' },
      { name: 'Pu C. Lalkhawngaiha', code: 'B12', username: 'bial12' }
    ];

    const membersByBial = [
      ['Lalrinsanga', 'Zonunsanga', 'Vanlalruati', 'Lalthanzuala', 'Malsawmtluanga', 'Lalmuanpuii', 'Lalremsanga', 'Lalramchhani', 'Lalhmangaiha', 'Lalrinawma', 'Laldinpuii', 'K. Lalnuntluanga'],
      ['Zothanmawia', 'H. Lalbiakdika', 'Lalnunsanga', 'R. Lalruatfela', 'Malsawmdawngliana', 'Vanlalhruaia', 'C. Lalnunmawii', 'Lalnunpuia', 'Lalawmpuia', 'Rebecca Lalhmangaihi', 'Zoramthanga', 'Lalchhandama'],
      ['F. Lalhmachhuana', 'Vanlalpeka', 'Lalduhawma', 'Lalrinzuala', 'Melody Lalnuntluangi', 'K. Zoramchhana', 'Esther Lalremruati', 'Lalbiakzuala', 'Lalengmawia', 'David Lalruatsanga', 'Lalnunfela', 'Ruth Vanlalhruaitluangi'],
      ['Joseph Laltlanhlua', 'Mary Lalbiaknungi', 'Samuel Lalhmingmawia', 'Lalrinmawia', 'Emanuel Lalduhsanga', 'Grace Lalrintluangi', 'John Lalramenga', 'Lalthlamuana', 'Lalmuanawma', 'Judy Lalrempuii', 'K. Lalrinfela', 'Lalnuntluanga Sailo'],
      ['Remlalnghaka', 'F. Lalnunsiama', 'Lalrintluanga', 'Zodinpuii', 'Lalramsanga', 'Vanlalthangi', 'Lalhminghlua', 'PC Lalbiakvela', 'Deborah Lalthanpuii', 'Joshua Lalrindika', 'Lalchhuanawma', 'H. Vanlalruata'],
      ['Vanlalzauva Ralte', 'Lalramhluna', 'C. Zodingliana', 'Lalduhzuala', 'Hannah Lalhmingmawii', 'Jonathan Lalpekhlua', 'Lalbiakchhungi', 'R. Lalremtluanga', 'Timothy Lalmuanzuala', 'Sarah Vanlalchhani', 'Lalhmingsanga', 'K. Laldinpuia'],
      ['PC Lalmuankima', 'Lalrinpuia', 'Vanlalhriata', 'Laltanpuia', 'Abigail Lalremsiami', 'Benjamin Lalnunthara', 'Cynthia Lalthanmawii', 'Daniel Lalruatdika', 'Lalramenga', 'Eunice Lalchhandami', 'PC Laldawngliana', 'Lalnunmawia'],
      ['FC Lalrintluanga', 'Vanlalruatsanga', 'Lalbiaknunga', 'Lalhmunmawia', 'Dorcas Lalmuanpuii', 'Gideon Lalduhawma', 'Isaac Lalremsanga', 'Jacob Lalnunzira', 'Naomi Lalrindiki', 'FC Zoramthanga', 'Lalrinchhana', 'Vanlalfela'],
      ['Pachuau Lalhmingliana', 'Vanlalchhuanga', 'Laldanmawia', 'Lalrohlua', 'Miriam Lalramlawmi', 'Nathan Lalmuanpuia', 'Philip Lalhmachhuana', 'Rachel Lalnunsangi', 'Stephen Lalremruata', 'Thomas Lalrintluanga', 'Pachuau Vanlalhruaia', 'Lalzamliana'],
      ['HL Lalnunmawia', 'Sangzuala', 'Lalhmingthanga', 'Lalruatkima', 'Tabitha Lalbiaktluangi', 'Victor Lalpeksanga', 'William Lalduhsanga', 'Zacharia Lalrinawma', 'Andrea Lalremruati', 'HL Laltlanzova', 'Lalmalsawma', 'Vanlalpekhlua'],
      ['F. Lalrinpuia', 'Chhuankima Ralte', 'Lalmuanfela', 'Lalrempuia', 'Bethany Lalthanzuali', 'Caleb Lalrindika', 'Daisy Lalnunengi', 'Joel Lalhruaitluanga', 'Luke Lalbiaksanga', 'F. Laldinmawia', 'Lalhmangaihsanga', 'Vanlalmalsawma'],
      ['C. Lalramzauva', 'Khawngaihthanga', 'Lalthanmawia', 'Lalnunthara', 'Elizabeth Lalremsangi', 'Felix Lalmuanpuia', 'Gloria Lalthanpuii', 'Henry Lalrinsanga', 'Irene Lalhmangaihi', 'C. Lalchhandama', 'Lalhruaitluanga', 'Zosangliana']
    ];

    const currentYear = 2026;

    bialsList.forEach((b, bIdx) => {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('password123', salt);

      const uRes = db.prepare('INSERT INTO users (username, password_hash, role, bial_name) VALUES (?, ?, ?, ?)').run(b.username, hash, 'BIAL', b.name);
      const bRes = db.prepare('INSERT INTO bials (name, code, user_id) VALUES (?, ?, ?)').run(b.name, b.code, uRes.lastInsertRowid);
      const bialId = bRes.lastInsertRowid;

      const sampleNames = membersByBial[bIdx] || [];
      sampleNames.forEach((name, idx) => {
        const mRes = db.prepare('INSERT INTO members (bial_id, year, sl_no, name) VALUES (?, ?, ?, ?)').run(bialId, currentYear, idx + 1, name);

        for (let m = 1; m <= 12; m++) {
          const randBase = Math.floor(Math.random() * (8500 - 3200 + 1)) + 3200;
          const totalAmount = Math.round(randBase / 100) * 100;
          const pr = Math.round((totalAmount * 0.48) / 50) * 50;
          const ram = Math.round((totalAmount * 0.22) / 50) * 50;
          const tual = Math.round((totalAmount * 0.15) / 50) * 50;
          const bldg = totalAmount - pr - ram - tual;
          const total = pr + ram + tual + bldg;

          db.prepare(`
            INSERT INTO tithes (member_id, bial_id, year, month, pathian_ram, ramthar, tualchhung, building, total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(mRes.lastInsertRowid, bialId, currentYear, m, pr, ram, tual, bldg, total);
        }
      });
    });
  }

  console.log('Database initialization complete.');
}

export function getTitheColumns() {
  try {
    const cols = db.prepare('SELECT id, name, code, field_key, color, display_order FROM tithe_columns ORDER BY display_order ASC, id ASC').all();
    if (cols && cols.length > 0) return cols;
  } catch (e) {}
  return [
    { id: 1, name: 'Pathian Ram', code: 'PTR', field_key: 'pathian_ram', color: '#6366f1', display_order: 1 },
    { id: 2, name: 'Ramthar', code: 'RT', field_key: 'ramthar', color: '#10b981', display_order: 2 },
    { id: 3, name: 'Tualchhung', code: 'Tch', field_key: 'tualchhung', color: '#f59e0b', display_order: 3 },
    { id: 4, name: 'Building', code: 'Bldg', field_key: 'building', color: '#a855f7', display_order: 4 }
  ];
}
