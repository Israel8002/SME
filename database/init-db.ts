import * as fs from "fs";
import * as path from "path";
import sqlite3 from "sqlite3";

const WORKSPACE_DIR = process.cwd();
const DB_PATH = path.join(WORKSPACE_DIR, "database", "sme.db");
const SCHEMA_PATH = path.join(WORKSPACE_DIR, "database", "schema.sql");
const CATALOGO_PATH = path.join(WORKSPACE_DIR, "CATALOGO.txt");

// Ensure directories exist
const DIRS = ["database", "backups", "exports", "imports", "logs"];
DIRS.forEach(d => {
  const dirPath = path.join(WORKSPACE_DIR, d);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
});

function parseJSArray(content: string, name: string): any[] {
  // Regular expression to match array definition
  const regex = new RegExp(`export const ${name}(?:\\s*:\\s*[\\w\\[\\]]+)?\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;`, "i");
  const match = content.match(regex);
  if (!match) {
    throw new Error(`Could not find array "${name}" in CATALOGO.txt`);
  }
  // Clean up references to types, imports, and evaluate
  const arrayBody = match[1]
    .replace(/\/\/.*/g, "") // remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, ""); // remove block comments
  
  try {
    return new Function(`return [${arrayBody}]`)();
  } catch (err: any) {
    throw new Error(`Failed to evaluate array "${name}": ${err.message}`);
  }
}

async function init() {
  console.log("Starting SME Database Initialization...");
  
  if (!fs.existsSync(CATALOGO_PATH)) {
    console.error(`CATALOGO.txt not found at: ${CATALOGO_PATH}`);
    process.exit(1);
  }

  const catalogoContent = fs.readFileSync(CATALOGO_PATH, "utf8");
  
  // Parse arrays
  console.log("Parsing CATALOGO.txt...");
  const cities = parseJSArray(catalogoContent, "cities");
  const units = parseJSArray(catalogoContent, "units");
  const rooms = parseJSArray(catalogoContent, "rooms");

  console.log(`Parsed ${cities.length} cities, ${units.length} units, and ${rooms.length} rooms successfully.`);

  // Connect to SQLite
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error("Error opening database:", err.message);
      process.exit(1);
    }
  });

  // Enable foreign keys
  db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("PRAGMA journal_mode = WAL;");
    
    // Execute DDL schema
    const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf8");
    const statements = schemaSql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log("Running DDL statements...");
    for (const stmt of statements) {
      db.run(stmt, (err) => {
        if (err) {
          console.error("Error running statement:", stmt);
          console.error(err.message);
        }
      });
    }

    console.log("DDL statements executed.");

    // Clear existing data (in case of re-run)
    db.run("DELETE FROM rooms;");
    db.run("DELETE FROM units;");
    db.run("DELETE FROM cities;");
    db.run("DELETE FROM settings;");

    // Insert Default Settings
    const stmtSettings = db.prepare(`
      INSERT INTO settings (
        id, intervaloPing, fallosConsecutivos, recuperacionesConsecutivas, timeout,
        rutaRespaldos, rutaExportaciones, nombreInstitucion, logo, actualizacionAutomatica, sondaIp
      ) VALUES (1, 30, 10, 3, 1000, ?, ?, 'IMSS OOAD BC', null, 1, '11.1.2.254')
    `);
    const backupsDir = path.join(WORKSPACE_DIR, "backups");
    const exportsDir = path.join(WORKSPACE_DIR, "exports");
    stmtSettings.run(backupsDir, exportsDir);
    stmtSettings.finalize();

    // Insert Cities
    const stmtCity = db.prepare("INSERT OR IGNORE INTO cities (id, nombre) VALUES (?, ?)");
    for (const city of cities) {
      stmtCity.run(city.id, city.nombre);
    }
    stmtCity.finalize();
    console.log("Inserted cities.");

    // Insert Units
    const nowISO = new Date().toISOString();
    const stmtUnit = db.prepare(`
      INSERT OR IGNORE INTO units (id, nombre, cityId, tipo, activo, fechaImportacion, ultimaActualizacion)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const unit of units) {
      stmtUnit.run(
        unit.id,
        unit.nombre,
        unit.cityId,
        unit.tipo,
        unit.activo ? 1 : 0,
        nowISO,
        nowISO
      );
    }
    stmtUnit.finalize();
    console.log("Inserted units.");

    // Insert Rooms
    const stmtRoom = db.prepare(`
      INSERT OR IGNORE INTO rooms (id, unitId, nombre, fechaImportacion, ultimaActualizacion)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    // In CATALOGO.txt, rooms have { nombre: string, unidadId: number } or { nombre: string, unitId: number }
    let roomCounter = 1;
    for (const room of rooms) {
      const uId = room.unidadId || room.unitId;
      if (!uId) continue;
      const roomId = `R-${uId}-${roomCounter++}`;
      stmtRoom.run(roomId, uId, room.nombre, nowISO, nowISO);
    }
    stmtRoom.finalize();
    console.log("Inserted rooms.");

    db.run("DELETE FROM monitor_status;");
    const stmtMon = db.prepare(`
      INSERT OR IGNORE INTO monitor_status (
        id, ultimaEjecucion, inicioServicio, estado, version, memoria, cpu, ipsMonitoreadas, ultimaActualizacion
      ) VALUES (1, ?, ?, 'OPERANDO', '1.0.0', 0, 0, 0, ?)
    `);
    stmtMon.run(nowISO, nowISO, nowISO);
    stmtMon.finalize();
    
    // Log import event
    const stmtLog = db.prepare(`
      INSERT INTO logs (fechaHora, nivel, modulo, evento, descripcion, usuario, ipEquipo, versionSistema)
      VALUES (?, 'INFO', 'Base de datos', 'Inicialización', 'Catálogos cargados exitosamente de CATALOGO.txt', 'Sistema', '127.0.0.1', '1.0.0')
    `);
    stmtLog.run(nowISO);
    stmtLog.finalize();

    console.log("Database seed completed successfully.");
    db.close((err) => {
      if (err) console.error("Error closing db:", err.message);
      console.log("SQLite database connection closed.");
    });
  });
}

init().catch(err => {
  console.error("Initialization failed:", err);
  process.exit(1);
});
