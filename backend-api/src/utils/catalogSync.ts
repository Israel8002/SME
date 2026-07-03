import { query } from "../config/db";
import * as path from "path";
import * as fs from "fs";

const WORKSPACE_DIR = path.resolve(__dirname, "../../../");

export async function syncCatalogs(): Promise<void> {
  try {
    // 1. Sync cities.json
    const dbCities = await query.all<any>("SELECT id, nombre FROM cities ORDER BY id ASC");
    const citiesFile = path.join(WORKSPACE_DIR, "cities.json");
    fs.writeFileSync(citiesFile, JSON.stringify(dbCities, null, 2), "utf8");

    // 2. Sync units.json
    const dbUnits = await query.all<any>("SELECT id, nombre, cityId, tipo, activo FROM units ORDER BY id ASC");
    const unitsData = dbUnits.map(u => ({
      id: u.id,
      nombre: u.nombre,
      cityId: u.cityId,
      tipo: u.tipo,
      activo: u.activo === 1
    }));
    const unitsFile = path.join(WORKSPACE_DIR, "units.json");
    fs.writeFileSync(unitsFile, JSON.stringify(unitsData, null, 2), "utf8");

    // 3. Sync rooms.json
    const dbRooms = await query.all<any>("SELECT nombre, unitId FROM rooms ORDER BY unitId ASC, nombre ASC");
    const roomsFile = path.join(WORKSPACE_DIR, "rooms.json");
    fs.writeFileSync(roomsFile, JSON.stringify(dbRooms, null, 2), "utf8");

    console.log("JSON catalogs successfully synced from SQLite database.");
  } catch (error) {
    console.error("Error syncing JSON catalogs:", error);
  }
}
