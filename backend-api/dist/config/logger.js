"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
exports.logEvent = logEvent;
const db_1 = require("./db");
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARNING"] = "WARNING";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["CRITICAL"] = "CRITICAL";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
async function logEvent(nivel, modulo, evento, descripcion, usuario = "Sistema", ipEquipo = "127.0.0.1") {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${nivel}] [${modulo}] ${evento}: ${descripcion}`);
    try {
        await db_1.query.run(`INSERT INTO logs (fechaHora, nivel, modulo, evento, descripcion, usuario, ipEquipo, versionSistema)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [timestamp, nivel, modulo, evento, descripcion, usuario, ipEquipo, "1.0.0"]);
    }
    catch (err) {
        console.error("Failed to write to database logs table:", err.message);
    }
}
