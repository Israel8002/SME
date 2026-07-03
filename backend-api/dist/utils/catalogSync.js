"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCatalogs = syncCatalogs;
const db_1 = require("../config/db");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const WORKSPACE_DIR = path.resolve(__dirname, "../../../");
async function syncCatalogs() {
    try {
        // 1. Sync cities.json
        const dbCities = await db_1.query.all("SELECT id, nombre FROM cities ORDER BY id ASC");
        const citiesFile = path.join(WORKSPACE_DIR, "cities.json");
        fs.writeFileSync(citiesFile, JSON.stringify(dbCities, null, 2), "utf8");
        // 2. Sync units.json
        const dbUnits = await db_1.query.all("SELECT id, nombre, cityId, tipo, activo FROM units ORDER BY id ASC");
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
        const dbRooms = await db_1.query.all("SELECT nombre, unitId FROM rooms ORDER BY unitId ASC, nombre ASC");
        const roomsFile = path.join(WORKSPACE_DIR, "rooms.json");
        fs.writeFileSync(roomsFile, JSON.stringify(dbRooms, null, 2), "utf8");
        console.log("JSON catalogs successfully synced from SQLite database.");
    }
    catch (error) {
        console.error("Error syncing JSON catalogs:", error);
    }
}
