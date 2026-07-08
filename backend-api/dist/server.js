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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const db_1 = require("./config/db");
const logger_1 = require("./config/logger");
const SettingsController_1 = require("./controllers/SettingsController");
const UnitController_1 = require("./controllers/UnitController");
const TicketController_1 = require("./controllers/TicketController");
const LogController_1 = require("./controllers/LogController");
const ImportController_1 = require("./controllers/ImportController");
const BackupController_1 = require("./controllers/BackupController");
const ExportController_1 = require("./controllers/ExportController");
dotenv.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "50mb" })); // Support large catalog imports
// --- Settings Endpoints ---
app.get("/api/settings", SettingsController_1.SettingsController.getSettings);
app.put("/api/settings", SettingsController_1.SettingsController.updateSettings);
// --- Units & IP Configuration Endpoints ---
app.get("/api/units", UnitController_1.UnitController.getUnits);
app.get("/api/units/:id", UnitController_1.UnitController.getUnitDetail);
app.get("/api/units/:id/ips", UnitController_1.UnitController.getUnitIps);
app.post("/api/units/:id/ips", UnitController_1.UnitController.createUnitIp);
app.put("/api/units/:id/ips/:ipId", UnitController_1.UnitController.updateUnitIp);
app.delete("/api/units/:id/ips/:ipId", UnitController_1.UnitController.deleteUnitIp);
app.put("/api/units/:id", UnitController_1.UnitController.updateUnit);
app.delete("/api/units/:id", UnitController_1.UnitController.deleteUnit);
app.post("/api/units", UnitController_1.UnitController.createUnit);
app.post("/api/units/:id/rooms", UnitController_1.UnitController.createRoom);
app.delete("/api/units/:id/rooms/:roomId", UnitController_1.UnitController.deleteRoom);
app.post("/api/units/:id/ips/:ipId/check", UnitController_1.UnitController.checkUnitIp);
app.post("/api/units/:id/check-ips", UnitController_1.UnitController.checkAllUnitIps);
// --- Tickets Endpoints ---
app.get("/api/tickets", TicketController_1.TicketController.getTickets);
app.get("/api/tickets/:id", TicketController_1.TicketController.getTicketDetail);
app.post("/api/tickets/:id/close", TicketController_1.TicketController.closeTicket);
app.put("/api/tickets/:id/proveedor", TicketController_1.TicketController.updateTicketProveedor);
app.post("/api/tickets/bulk-delete", TicketController_1.TicketController.deleteTicketsBulk);
app.delete("/api/tickets", TicketController_1.TicketController.deleteTicketsByRange);
app.delete("/api/tickets/:id", TicketController_1.TicketController.deleteTicket);
// --- Logs Endpoints ---
app.get("/api/logs", LogController_1.LogController.getLogs);
app.delete("/api/logs", LogController_1.LogController.clearLogs);
// --- Import Endpoints ---
app.get("/api/imports", ImportController_1.ImportController.getImportHistory);
app.post("/api/imports", ImportController_1.ImportController.importCatalogs);
// --- Backup Endpoints ---
app.get("/api/backups", BackupController_1.BackupController.getBackupHistory);
app.post("/api/backups", BackupController_1.BackupController.createBackup);
app.post("/api/backups/restore/:id", BackupController_1.BackupController.restoreBackup);
// --- Export Endpoints ---
app.get("/api/exports", ExportController_1.ExportController.getExportHistory);
app.get("/api/exports/run", ExportController_1.ExportController.exportData);
// --- Dashboard Status Summary Endpoint ---
app.get("/api/status", async (req, res) => {
    try {
        // 1. Monitor state
        const monitor = await db_1.query.get("SELECT * FROM monitor_status WHERE id = 1");
        // 2. Metrics counts
        const totalUnits = await db_1.query.get("SELECT COUNT(*) AS count FROM units");
        const activeUnits = await db_1.query.get("SELECT COUNT(*) AS count FROM units WHERE activo = 1");
        // Units with open tickets (incidents)
        const openTickets = await db_1.query.get("SELECT COUNT(*) AS count FROM tickets WHERE estado = 'Abierto'");
        // Tickets closed today
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const today = `${year}-${month}-${day}`;
        const closedToday = await db_1.query.get("SELECT COUNT(*) AS count FROM tickets WHERE estado = 'Cerrado' AND fechaFin = ?", [today]);
        // Availability Average
        const availabilityRow = await db_1.query.all(`
      SELECT id FROM units WHERE activo = 1
    `);
        // Calculate global average availability (just basic placeholder since calculation runs unit-by-unit)
        const totalCount = availabilityRow.length || 1;
        // Check if monitor is running (last execution within 2 minutes)
        let isRunning = false;
        if (monitor) {
            const lastExec = new Date(monitor.ultimaEjecucion).getTime();
            const diffMin = (Date.now() - lastExec) / 1000 / 60;
            if (diffMin <= 2.0) {
                isRunning = true;
            }
        }
        res.json({
            monitor: monitor ? {
                estado: isRunning ? "OPERANDO" : "DETENIDO",
                version: monitor.version,
                inicioServicio: monitor.inicioServicio,
                ultimaEjecucion: monitor.ultimaEjecucion,
                memoria: monitor.memoria,
                cpu: monitor.cpu,
                ipsMonitoreadas: monitor.ipsMonitoreadas || 0
            } : { estado: "DETENIDO", version: "1.0.0" },
            summary: {
                totalUnidades: totalUnits?.count || 0,
                unidadesActivas: activeUnits?.count || 0,
                unidadesOperativas: Math.max(0, (activeUnits?.count || 0) - (openTickets?.count || 0)),
                unidadesConIncidencia: openTickets?.count || 0,
                ticketsAbiertos: openTickets?.count || 0,
                ticketsCerradosHoy: closedToday?.count || 0,
                disponibilidadGeneral: 99.85 // Global institutional availability target placeholder
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Serve Frontend Static Files
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
app.use(express_1.default.static(frontendDistPath));
app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.includes(".")) {
        return next();
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
});
// Start Server
app.listen(PORT, async () => {
    console.log(`SME API Server is running on port ${PORT}`);
    await (0, logger_1.logEvent)(logger_1.LogLevel.INFO, "API", "Inicio", `Servidor de API REST iniciado en el puerto ${PORT}.`);
});
