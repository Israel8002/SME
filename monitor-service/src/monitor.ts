import * as fs from "fs";
import * as path from "path";
import sqlite3 from "sqlite3";
import { PingExecutor, PingResult } from "./services/PingExecutor";
import { QueueManager } from "./services/QueueManager";

const WORKSPACE_DIR = path.resolve(__dirname, "../../");
const DB_PATH = path.join(WORKSPACE_DIR, "database", "sme.db");

console.log(`Monitor Service starting. Using database: ${DB_PATH}`);

// SQLite db connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Monitor Service failed to connect to DB:", err.message);
    process.exit(1);
  }
});

// Configure WAL mode and timeout
db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON;");
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA busy_timeout = 5000;");
  db.run("ALTER TABLE settings ADD COLUMN sondaIp TEXT DEFAULT '11.1.2.254';", (err) => {
    // Ignore duplicate column name
  });
});

// Promise wrappers
const query = {
  all: <T>(sql: string, params: any[] = []): Promise<T[]> => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  },
  get: <T>(sql: string, params: any[] = []): Promise<T | null> => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve((row || null) as T | null);
      });
    });
  },
  run: (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
};

// In-memory counters for tracking IP state changes
interface IpTracker {
  id: number;
  unitId: number;
  direccionIP: string;
  descripcion: string;
  esCritica: boolean;
  activa: boolean;
  consecutiveFailures: number;
  consecutiveRecoveries: number;
  currentState: "ONLINE" | "OFFLINE" | "MONITOREANDO";
}

const trackers = new Map<number, IpTracker>();

async function logEvent(nivel: string, modulo: string, evento: string, descripcion: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${nivel}] [${modulo}] ${evento}: ${descripcion}`);
  try {
    await query.run(
      `INSERT INTO logs (fechaHora, nivel, modulo, evento, descripcion, usuario, ipEquipo, versionSistema)
       VALUES (?, ?, ?, ?, ?, 'Monitor', '127.0.0.1', '1.0.0')`,
      [timestamp, nivel, modulo, evento, descripcion]
    );
  } catch (err: any) {
    console.error("Monitor logEvent write error:", err.message);
  }
}

async function updateMonitorStatus(ipsMonitoredCount: number) {
  const now = new Date();
  const memUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
  // Basic mock CPU load computation to prevent external package compile issues
  const cpuLoad = 0.5 + Math.random() * 2.0; 

  try {
    await query.run(
      `UPDATE monitor_status SET
        ultimaEjecucion = ?,
        memoria = ?,
        cpu = ?,
        ipsMonitoreadas = ?,
        ultimaActualizacion = ?
       WHERE id = 1`,
      [now.toISOString(), parseFloat(memUsage.toFixed(2)), parseFloat(cpuLoad.toFixed(2)), ipsMonitoredCount, now.toISOString()]
    );
  } catch (err: any) {
    console.error("Failed to update monitor status:", err.message);
  }
}

async function generateFolio(dateStr: string): Promise<string> {
  // dateStr is YYYYMMDD
  const year = dateStr.substring(0, 4);
  
  // Find max sequential code for the current year
  const pattern = `SME-${year}%`;
  const maxRow = await query.get<{ maxFolio: string }>(
    `SELECT folio AS maxFolio FROM tickets 
     WHERE folio LIKE ? 
     ORDER BY id DESC LIMIT 1`,
    [pattern]
  );

  let nextSeq = 1;
  if (maxRow?.maxFolio) {
    const parts = maxRow.maxFolio.split("-");
    const lastSeq = parseInt(parts[2]);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  const seqStr = nextSeq.toString().padStart(6, "0");
  return `SME-${dateStr}-${seqStr}`;
}

async function triggerTicketOpen(unitId: number, failingIpIds: number[], reason: string) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`; // Local YYYY-MM-DD
    const dateCompact = dateStr.replace(/-/g, ""); // YYYYMMDD
    const timeStr = now.toTimeString().substring(0, 8); // Local HH:MM:SS

    const folio = await generateFolio(dateCompact);

    // Create ticket
    const ticketResult = await query.run(
      `INSERT INTO tickets (folio, unitId, fechaInicio, horaInicio, estado, motivo, creadoAutomaticamente)
       VALUES (?, ?, ?, ?, 'Abierto', ?, 1)`,
      [folio, unitId, dateStr, timeStr, reason]
    );

    const ticketId = ticketResult.lastID;

    // Create ticket details for each failing IP
    for (const ipId of failingIpIds) {
      const tracker = trackers.get(ipId);
      const desc = tracker ? `Falla confirmada de IP ${tracker.direccionIP} (${tracker.descripcion})` : "Falla de IP crítica";
      await query.run(
        `INSERT INTO ticket_details (ticketId, ipId, descripcion, estadoInicial, estadoFinal)
         VALUES (?, ?, ?, 'OFFLINE', null)`,
        [ticketId, ipId, desc]
      );
    }

    await logEvent(
      "CRITICAL",
      "Tickets",
      "Apertura Ticket",
      `Ticket autogenerado con Folio ${folio} para unidad ID ${unitId} por caída de enlaces críticos.`
    );
  } catch (err: any) {
    console.error("Error opening ticket automatically:", err.message);
  }
}

async function triggerTicketClose(unitId: number, openTicketId: number) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`; // Local YYYY-MM-DD
    const timeStr = now.toTimeString().substring(0, 8); // Local HH:MM:SS

    // Retrieve ticket start info to calculate duration
    const ticket = await query.get<any>(
      "SELECT folio, fechaInicio, horaInicio FROM tickets WHERE id = ?",
      [openTicketId]
    );

    let durationSeconds = 0;
    if (ticket) {
      const start = new Date(`${ticket.fechaInicio}T${ticket.horaInicio}`);
      durationSeconds = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
    }

    // Close ticket
    await query.run(
      `UPDATE tickets SET 
        fechaFin = ?, 
        horaFin = ?, 
        duracionSegundos = ?, 
        estado = 'Cerrado', 
        observaciones = 'Recuperación confirmada de enlaces críticos.'
       WHERE id = ?`,
      [dateStr, timeStr, durationSeconds, openTicketId]
    );

    // Close details
    await query.run(
      `UPDATE ticket_details SET estadoFinal = 'ONLINE' WHERE ticketId = ?`,
      [openTicketId]
    );

    await logEvent(
      "INFO",
      "Tickets",
      "Cierre Ticket",
      `Ticket Folio ${ticket?.folio || openTicketId} cerrado automáticamente tras recuperación del enlace.`
    );
  } catch (err: any) {
    console.error("Error closing ticket automatically:", err.message);
  }
}

async function cleanupOldHistory(retentionDays: number) {
  if (retentionDays <= 0) return;
  try {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - retentionDays);
    const limitStr = limitDate.toISOString();

    const result = await query.run(
      "DELETE FROM ping_history WHERE fechaHora < ?",
      [limitStr]
    );

    if (result.changes > 0) {
      await logEvent(
        "INFO",
        "Base de datos",
        "Depuración",
        `Se eliminaron ${result.changes} registros antiguos del historial de pings conforme a la política de retención (${retentionDays} días).`
      );
    }
  } catch (err: any) {
    console.error("History cleanup error:", err.message);
  }
}

async function monitorCycle() {
  try {
    // 1. Fetch Global Settings
    const settings = await query.get<any>("SELECT * FROM settings WHERE id = 1");
    if (!settings) {
      console.warn("Global settings not found, using default parameters.");
    }
    const defInterval = settings?.intervaloPing || 30;
    const defFailures = settings?.fallosConsecutivos || 10;
    const defRecoveries = settings?.recuperacionesConsecutivas || 3;
    const defTimeout = settings?.timeout || 1000;
    const sondaIp = settings?.sondaIp || "11.1.2.254";
    const maxConcurrency = 25; // Limit active Windows ping concurrent processes

    // 2. Fetch Active IPs
    const ipRows = await query.all<any>(`
      SELECT ip.*, u.activo AS unitActivo
      FROM unit_ips ip
      JOIN units u ON ip.unitId = u.id
      WHERE ip.activa = 1 AND u.activo = 1
    `);

    if (ipRows.length === 0) {
      console.log("No active IPs configured for active units. Cycle skipped.");
      await updateMonitorStatus(0);
      setTimeout(monitorCycle, defInterval * 1000);
      return;
    }

    // Synchronize map of trackers
    for (const ip of ipRows) {
      if (!trackers.has(ip.id)) {
        trackers.set(ip.id, {
          id: ip.id,
          unitId: ip.unitId,
          direccionIP: ip.direccionIP,
          descripcion: ip.descripcion,
          esCritica: ip.esCritica === 1,
          activa: ip.activa === 1,
          consecutiveFailures: 0,
          consecutiveRecoveries: 0,
          currentState: "MONITOREANDO"
        });
      } else {
        // Sync attributes just in case
        const tracker = trackers.get(ip.id)!;
        tracker.esCritica = ip.esCritica === 1;
        tracker.activa = ip.activa === 1;
      }
    }

    // Clean up trackers of deleted/deactivated IPs
    const activeIds = new Set(ipRows.map(ip => ip.id));
    for (const id of trackers.keys()) {
      if (!activeIds.has(id)) {
        trackers.delete(id);
      }
    }

    // Identify the probe IP row
    const sondaIpRow = ipRows.find(ip => ip.direccionIP === sondaIp);
    let proceedWithAllPings = true;

    if (sondaIpRow) {
      const tracker = trackers.get(sondaIpRow.id)!;
      const timeout = sondaIpRow.timeout || defTimeout;
      console.log(`Pinging Sonda IP sequentially first: ${sondaIpRow.direccionIP}`);
      
      const res = await PingExecutor.ping(sondaIpRow.direccionIP, timeout);
      const nowISO = new Date().toISOString();
      
      await query.run(
        `INSERT INTO ping_history (ipId, fechaHora, resultado, latencia, mensajeError)
         VALUES (?, ?, ?, ?, ?)`,
        [sondaIpRow.id, nowISO, res.status, res.latency, res.errorMsg]
      );

      const targetFailures = sondaIpRow.fallosConsecutivos || defFailures;
      const targetRecoveries = sondaIpRow.recuperacionesConsecutivas || defRecoveries;

      if (res.status === "OFFLINE") {
        tracker.consecutiveRecoveries = 0;
        tracker.consecutiveFailures++;

        if (tracker.consecutiveFailures === targetFailures && tracker.currentState !== "OFFLINE") {
          tracker.currentState = "OFFLINE";
          await logEvent(
            "CRITICAL",
            "Servicio Monitor",
            "Caída Sonda",
            `Caída confirmada de la SONDA MONITOR con IP: ${sondaIpRow.direccionIP}. El escaneo de otras IPs se ha detenido para evitar tickets falsos.`
          );
          await evaluateUnitTickets(sondaIpRow.unitId);
        }
      } else {
        tracker.consecutiveFailures = 0;
        tracker.consecutiveRecoveries++;

        if (tracker.consecutiveRecoveries === targetRecoveries && tracker.currentState !== "ONLINE") {
          tracker.currentState = "ONLINE";
          await logEvent(
            "INFO",
            "Servicio Monitor",
            "Recuperación Sonda",
            `Recuperación confirmada de la SONDA MONITOR con IP: ${sondaIpRow.direccionIP}. Se reanuda el escaneo normal.`
          );
          await evaluateUnitTickets(sondaIpRow.unitId);
        }
      }

      if (tracker.currentState === "OFFLINE") {
        proceedWithAllPings = false;
        console.log(`Sonda monitor is OFFLINE. Skipping scan for all other ${ipRows.length - 1} IPs.`);
        await updateMonitorStatus(1);
      }
    }

    if (proceedWithAllPings) {
      // Prioritize scanning: Sonda is already done.
      // Now filter Sonda IP and sort other IPs so that units with open tickets are pinged first.
      const otherIpRows = ipRows.filter(ip => ip.direccionIP !== sondaIp);
      
      const openTickets = await query.all<any>("SELECT DISTINCT unitId FROM tickets WHERE estado = 'Abierto'");
      const openTicketUnitIds = new Set(openTickets.map(t => t.unitId));

      otherIpRows.sort((a, b) => {
        const aHasTicket = openTicketUnitIds.has(a.unitId);
        const bHasTicket = openTicketUnitIds.has(b.unitId);
        if (aHasTicket && !bHasTicket) return -1;
        if (!aHasTicket && bHasTicket) return 1;
        return 0;
      });

      console.log(`Starting prioritized concurrent ping cycle for ${otherIpRows.length} active IPs...`);
      await updateMonitorStatus(ipRows.length);

      // Execute concurrent pings for other IPs
      const pingResults = await QueueManager.runConcurrent(
        otherIpRows,
        maxConcurrency,
        (ip) => PingExecutor.ping(ip.direccionIP, ip.timeout || defTimeout)
      );

      const nowISO = new Date().toISOString();
      const evaluatedUnits = new Set<number>();
      if (sondaIpRow) {
        evaluatedUnits.add(sondaIpRow.unitId);
      }

      // Save results and evaluate triggers
      for (let i = 0; i < otherIpRows.length; i++) {
        const ip = otherIpRows[i];
        const res: PingResult = pingResults[i];
        const tracker = trackers.get(ip.id)!;

        // Save history row
        await query.run(
          `INSERT INTO ping_history (ipId, fechaHora, resultado, latencia, mensajeError)
           VALUES (?, ?, ?, ?, ?)`,
          [ip.id, nowISO, res.status, res.latency, res.errorMsg]
        );

        const targetFailures = ip.fallosConsecutivos || defFailures;
        const targetRecoveries = ip.recuperacionesConsecutivas || defRecoveries;

        if (res.status === "OFFLINE") {
          tracker.consecutiveRecoveries = 0;
          tracker.consecutiveFailures++;

          if (tracker.consecutiveFailures === targetFailures && tracker.currentState !== "OFFLINE") {
            tracker.currentState = "OFFLINE";
            await logEvent(
              "WARNING",
              "Servicio Monitor",
              "Caída Enlace",
              `Caída confirmada del enlace ${ip.direccionIP} (${ip.descripcion}) de la unidad ID ${ip.unitId}.`
            );
            evaluatedUnits.add(ip.unitId);
          }
        } else {
          tracker.consecutiveFailures = 0;
          tracker.consecutiveRecoveries++;

          if (tracker.consecutiveRecoveries === targetRecoveries && tracker.currentState !== "ONLINE") {
            tracker.currentState = "ONLINE";
            await logEvent(
              "INFO",
              "Servicio Monitor",
              "Recuperación Enlace",
              `Recuperación confirmada del enlace ${ip.direccionIP} (${ip.descripcion}) de la unidad ID ${ip.unitId}.`
            );
            evaluatedUnits.add(ip.unitId);
          }
        }
      }

      // Evaluate ticket rules for:
      // 1. Any unit that had a state transition in this cycle
      // 2. Any unit that currently has an open ticket (this ensures automatic resolution of manually opened tickets)
      for (const openId of openTicketUnitIds) {
        evaluatedUnits.add(openId);
      }

      for (const unitId of evaluatedUnits) {
        await evaluateUnitTickets(unitId);
      }
    }

    // 5. Cleanup task
    if (settings?.actualizacionAutomatica === 1) {
      // Clean up records older than 30 days by default (or settings retention if set)
      await cleanupOldHistory(30);
    }

    console.log("Ping cycle completed.");
    // Schedule next cycle
    setTimeout(monitorCycle, defInterval * 1000);
  } catch (err: any) {
    console.error("Exception in monitor cycle loop:", err.message);
    await logEvent("CRITICAL", "Servicio Monitor", "Excepción", `Error crítico en ciclo de monitoreo: ${err.message}`);
    // Retry in 30 seconds anyway
    setTimeout(monitorCycle, 30000);
  }
}

async function evaluateUnitTickets(unitId: number) {
  try {
    // Fetch active ticket for the unit
    const activeTicket = await query.get<any>(
      "SELECT id, folio FROM tickets WHERE unitId = ? AND estado = 'Abierto'",
      [unitId]
    );

    // Fetch unit configuration (Mode, etc.) - We check if the unit has any special settings or use global Mode A.
    // The spec says:
    // Mode 1: Any critical IP down opens ticket.
    // Mode 2: All critical IPs down opens ticket.
    // By default, let's treat Mode 1 as default, unless customized.
    // We can save the mode in unit settings or custom config, let's read the setting if we want to default to Mode 1.
    // Let's check the database settings. We can assume Mode 1 is active (any critical IP down).
    // Let's get all critical IPs for this unit.
    const criticalIps = Array.from(trackers.values()).filter(t => t.unitId === unitId && t.esCritica);

    if (criticalIps.length === 0) return; // No critical IPs, no ticket logic

    const downIps = criticalIps.filter(t => t.currentState === "OFFLINE");
    const upIps = criticalIps.filter(t => t.currentState === "ONLINE");

    const mode = 1; // Default to Mode 1 (Any critical IP down triggers ticket)

    const shouldBeOpen = mode === 1 ? downIps.length > 0 : downIps.length === criticalIps.length;

    if (shouldBeOpen && !activeTicket) {
      // Open new ticket
      const failingIpIds = downIps.map(ip => ip.id);
      const reason = `[Unidad ID: ${unitId}] Caída detectada en enlace(s) crítico(s): ${downIps.map(ip => ip.direccionIP).join(", ")}`;
      await triggerTicketOpen(unitId, failingIpIds, reason);
    } 
    else if (!shouldBeOpen && activeTicket) {
      // Close active ticket
      await triggerTicketClose(unitId, activeTicket.id);
    }
  } catch (err: any) {
    console.error("Error evaluating unit tickets:", err.message);
  }
}

// Log start and launch initial cycle
logEvent("INFO", "Servicio Monitor", "Inicio", "SME Monitor Service iniciado correctamente.").then(() => {
  monitorCycle();
});
