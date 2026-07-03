import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import * as path from "path";
import { query } from "./config/db";
import { logEvent, LogLevel } from "./config/logger";
import { SettingsController } from "./controllers/SettingsController";
import { UnitController } from "./controllers/UnitController";
import { TicketController } from "./controllers/TicketController";
import { LogController } from "./controllers/LogController";
import { ImportController } from "./controllers/ImportController";
import { BackupController } from "./controllers/BackupController";
import { ExportController } from "./controllers/ExportController";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" })); // Support large catalog imports

// --- Settings Endpoints ---
app.get("/api/settings", SettingsController.getSettings);
app.put("/api/settings", SettingsController.updateSettings);

// --- Units & IP Configuration Endpoints ---
app.get("/api/units", UnitController.getUnits);
app.get("/api/units/:id", UnitController.getUnitDetail);
app.get("/api/units/:id/ips", UnitController.getUnitIps);
app.post("/api/units/:id/ips", UnitController.createUnitIp);
app.put("/api/units/:id/ips/:ipId", UnitController.updateUnitIp);
app.delete("/api/units/:id/ips/:ipId", UnitController.deleteUnitIp);
app.put("/api/units/:id", UnitController.updateUnit);
app.delete("/api/units/:id", UnitController.deleteUnit);
app.post("/api/units", UnitController.createUnit);
app.post("/api/units/:id/rooms", UnitController.createRoom);
app.delete("/api/units/:id/rooms/:roomId", UnitController.deleteRoom);

// --- Tickets Endpoints ---
app.get("/api/tickets", TicketController.getTickets);
app.get("/api/tickets/:id", TicketController.getTicketDetail);
app.post("/api/tickets/:id/close", TicketController.closeTicket);
app.delete("/api/tickets", TicketController.deleteTicketsByRange);
app.delete("/api/tickets/:id", TicketController.deleteTicket);

// --- Logs Endpoints ---
app.get("/api/logs", LogController.getLogs);

// --- Import Endpoints ---
app.get("/api/imports", ImportController.getImportHistory);
app.post("/api/imports", ImportController.importCatalogs);

// --- Backup Endpoints ---
app.get("/api/backups", BackupController.getBackupHistory);
app.post("/api/backups", BackupController.createBackup);
app.post("/api/backups/restore/:id", BackupController.restoreBackup);

// --- Export Endpoints ---
app.get("/api/exports", ExportController.getExportHistory);
app.get("/api/exports/run", ExportController.exportData);

// --- Dashboard Status Summary Endpoint ---
app.get("/api/status", async (req, res) => {
  try {
    // 1. Monitor state
    const monitor = await query.get<any>("SELECT * FROM monitor_status WHERE id = 1");
    
    // 2. Metrics counts
    const totalUnits = await query.get<{ count: number }>("SELECT COUNT(*) AS count FROM units");
    const activeUnits = await query.get<{ count: number }>("SELECT COUNT(*) AS count FROM units WHERE activo = 1");
    
    // Units with open tickets (incidents)
    const openTickets = await query.get<{ count: number }>("SELECT COUNT(*) AS count FROM tickets WHERE estado = 'Abierto'");
    
    // Tickets closed today
    const today = new Date().toISOString().substring(0, 10);
    const closedToday = await query.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM tickets WHERE estado = 'Cerrado' AND fechaFin = ?",
      [today]
    );

    // Availability Average
    const availabilityRow = await query.all<any>(`
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve Frontend Static Files
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
app.use(express.static(frontendDistPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

// Start Server
app.listen(PORT, async () => {
  console.log(`SME API Server is running on port ${PORT}`);
  await logEvent(
    LogLevel.INFO,
    "API",
    "Inicio",
    `Servidor de API REST iniciado en el puerto ${PORT}.`
  );
});
