import { Request, Response } from "express";
import { query } from "../config/db";
import { logEvent, LogLevel } from "../config/logger";
import { UnitIPSchema } from "shared";
import { syncCatalogs } from "../utils/catalogSync";
import { formatDuration } from "./TicketController";
import { spawn } from "child_process";


export class UnitController {
  static async getUnits(req: Request, res: Response) {
    try {
      const search = req.query.search ? `%${req.query.search}%` : "%";
      const cityId = req.query.cityId || "";
      const tipo = req.query.tipo || "";
      const state = req.query.state || ""; // Operativa, Con Incidencia, Deshabilitada, etc.
      const hasTicket = req.query.hasTicket || ""; // yes, no
      
      const sortColumn = req.query.sortColumn || "id";
      const sortOrder = req.query.sortOrder === "desc" ? "DESC" : "ASC";
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      // Base query to fetch units with metadata
      let sql = `
        SELECT 
          u.id, 
          u.nombre, 
          u.cityId, 
          c.nombre AS ciudadNombre,
          u.tipo, 
          u.activo,
          (SELECT COUNT(*) FROM unit_ips WHERE unitId = u.id) AS ipsConfiguradas,
          (SELECT COUNT(*) FROM unit_ips WHERE unitId = u.id AND esCritica = 1) AS ipsCriticas,
          (SELECT folio FROM tickets WHERE unitId = u.id AND estado = 'Abierto' ORDER BY id DESC LIMIT 1) AS ticketActivo,
          (SELECT MAX(fechaInicio || ' ' || horaInicio) FROM tickets WHERE unitId = u.id) AS ultimaCaida,
          (SELECT MAX(fechaFin || ' ' || horaFin) FROM tickets WHERE unitId = u.id AND estado = 'Cerrado') AS ultimaRecuperacion
        FROM units u
        JOIN cities c ON u.cityId = c.id
        WHERE (u.nombre LIKE ? OR u.id LIKE ? OR c.nombre LIKE ? OR u.tipo LIKE ?)
      `;
      
      const params: any[] = [search, search, search, search];

      if (cityId) {
        sql += " AND u.cityId = ?";
        params.push(cityId);
      }
      if (tipo) {
        sql += " AND u.tipo = ?";
        params.push(tipo);
      }
      if (req.query.activo !== undefined) {
        sql += " AND u.activo = ?";
        params.push(req.query.activo === "true" ? 1 : 0);
      }

      // Add state and ticket filters after fetching or in subqueries.
      // Let's implement filters directly in SQL where possible, or process them in JS if complex.
      // To filter by ticketActivo (hasTicket)
      if (hasTicket === "yes") {
        sql += " AND EXISTS (SELECT 1 FROM tickets WHERE unitId = u.id AND estado = 'Abierto')";
      } else if (hasTicket === "no") {
        sql += " AND NOT EXISTS (SELECT 1 FROM tickets WHERE unitId = u.id AND estado = 'Abierto')";
      }

      // Sorting (Sanitize column name to avoid SQL Injection)
      const allowedColumns = ["id", "nombre", "cityId", "tipo", "activo", "ipsConfiguradas", "ipsCriticas", "ultimaCaida", "ultimaRecuperacion"];
      const actualSortColumn = allowedColumns.includes(sortColumn as string) ? (sortColumn as string) : "id";
      
      const columnMapping: Record<string, string> = {
        id: "u.id",
        nombre: "u.nombre",
        cityId: "u.cityId",
        tipo: "u.tipo",
        activo: "u.activo",
        ipsConfiguradas: "ipsConfiguradas",
        ipsCriticas: "ipsCriticas",
        ultimaCaida: "ultimaCaida",
        ultimaRecuperacion: "ultimaRecuperacion"
      };
      const sortColumnMapped = columnMapping[actualSortColumn] || "u.id";
      sql += ` ORDER BY ${sortColumnMapped} ${sortOrder}`;
      
      // Get total count first for pagination metadata
      const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
      const totalRow = await query.get<{ total: number }>(countSql, params);
      const total = totalRow ? totalRow.total : 0;

      // Add pagination
      sql += " LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const rows = await query.all<any>(sql, params);

      // Post-process units to add dynamic state & availability metrics
      const unitsWithMetrics = await Promise.all(rows.map(async (unit) => {
        // Calculate State
        let calculatedState = "Operativa";
        if (unit.activo === 0) {
          calculatedState = "Deshabilitada";
        } else if (unit.ticketActivo) {
          calculatedState = "Con Incidencia";
        } else if (unit.ipsConfiguradas === 0) {
          calculatedState = "Monitoreando"; // No IPs configured, idle
        } else {
          // Check if any IP was checked recently. If not, state is "Monitoreando"
          calculatedState = "Operativa";
        }

        // Calculate Monthly Availability
        // Formula: Percentage of time in the current month without open/closed tickets
        const availability = await calculateAvailability(unit.id);

        return {
          ...unit,
          estado: calculatedState,
          disponibilidad: availability
        };
      }));

      // Filter by state in memory if state filter is applied
      let filteredResult = unitsWithMetrics;
      if (state) {
        filteredResult = unitsWithMetrics.filter(u => u.estado.toLowerCase() === (state as string).toLowerCase());
      }

      res.json({
        data: filteredResult,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getUnitDetail(req: Request, res: Response) {
    try {
      const unitId = req.params.id;
      const unit = await query.get<any>(
        `SELECT u.*, c.nombre AS ciudadNombre 
         FROM units u 
         JOIN cities c ON u.cityId = c.id 
         WHERE u.id = ?`,
        [unitId]
      );
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }

      // Fetch Rooms
      const rooms = await query.all("SELECT * FROM rooms WHERE unitId = ?", [unitId]);
      
      // Fetch IPs with last ping status and latency from ping_history
      const ips = await query.all(
        `SELECT ip.*,
                (SELECT resultado FROM ping_history WHERE ipId = ip.id ORDER BY id DESC LIMIT 1) AS ultimoResultado,
                (SELECT latencia FROM ping_history WHERE ipId = ip.id ORDER BY id DESC LIMIT 1) AS ultimaLatencia,
                (SELECT fechaHora FROM ping_history WHERE ipId = ip.id ORDER BY id DESC LIMIT 1) AS ultimoPingFechaHora
         FROM unit_ips ip
         WHERE ip.unitId = ?
         ORDER BY ip.id DESC`,
        [unitId]
      );

      // Fetch Recent Tickets (limit 10)
      const tickets = await query.all(
        "SELECT * FROM tickets WHERE unitId = ? ORDER BY id DESC LIMIT 10",
        [unitId]
      );

      // Fetch availability
      const disponibilidad = await calculateAvailability(unit.id);

      // Calculate unit state
      let calculatedState = "Operativa";
      const hasActiveTicket = tickets.some((t: any) => t.estado === "Abierto");
      if (unit.activo === 0) {
        calculatedState = "Deshabilitada";
      } else if (hasActiveTicket) {
        calculatedState = "Con Incidencia";
      } else if (ips.length === 0) {
        calculatedState = "Monitoreando";
      }

      const mappedTickets = tickets.map((t: any) => ({
        ...t,
        duracionLegible: formatDuration(t.duracionSegundos, t.estado === "Abierto", t.fechaInicio, t.horaInicio)
      }));

      res.json({
        ...unit,
        estado: calculatedState,
        disponibilidad,
        rooms,
        ips,
        tickets: mappedTickets
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // --- IP Configuration Endpoints ---
  static async getUnitIps(req: Request, res: Response) {
    try {
      const unitId = req.params.id;
      const ips = await query.all("SELECT * FROM unit_ips WHERE unitId = ? ORDER BY id DESC", [unitId]);
      res.json(ips);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createUnitIp(req: Request, res: Response) {
    try {
      const unitId = parseInt(req.params.id);
      const parsed = UnitIPSchema.safeParse({ ...req.body, unitId });
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid IP configuration", details: parsed.error.format() });
      }

      const { direccionIP, descripcion, esCritica, activa, timeout, intervaloPing } = parsed.data;

      // Duplicate validation
      const existing = await query.get(
        "SELECT id FROM unit_ips WHERE unitId = ? AND direccionIP = ?",
        [unitId, direccionIP]
      );
      if (existing) {
        return res.status(400).json({ error: "IP address already configured for this unit" });
      }

      const now = new Date().toISOString();
      const result = await query.run(
        `INSERT INTO unit_ips (unitId, direccionIP, descripcion, esCritica, activa, timeout, intervaloPing, fechaAlta, ultimaModificacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          unitId,
          direccionIP,
          descripcion,
          esCritica ? 1 : 0,
          activa ? 1 : 0,
          timeout,
          intervaloPing,
          now,
          now
        ]
      );

      await logEvent(
        LogLevel.INFO,
        "Unidades",
        "Alta IP",
        `IP ${direccionIP} agregada a la unidad con ID ${unitId}.`
      );

      res.status(201).json({ id: result.lastID, message: "IP created successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateUnitIp(req: Request, res: Response) {
    try {
      const unitId = parseInt(req.params.id);
      const ipId = parseInt(req.params.ipId);
      const parsed = UnitIPSchema.safeParse({ ...req.body, unitId });

      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid IP configuration", details: parsed.error.format() });
      }

      const { direccionIP, descripcion, esCritica, activa, timeout, intervaloPing } = parsed.data;

      // Duplicate validation excluding current
      const existing = await query.get(
        "SELECT id FROM unit_ips WHERE unitId = ? AND direccionIP = ? AND id <> ?",
        [unitId, direccionIP, ipId]
      );
      if (existing) {
        return res.status(400).json({ error: "Another IP is already configured with this address" });
      }

      const now = new Date().toISOString();
      await query.run(
        `UPDATE unit_ips SET 
          direccionIP = ?, 
          descripcion = ?, 
          esCritica = ?, 
          activa = ?, 
          timeout = ?, 
          intervaloPing = ?, 
          ultimaModificacion = ?
         WHERE id = ? AND unitId = ?`,
        [
          direccionIP,
          descripcion,
          esCritica ? 1 : 0,
          activa ? 1 : 0,
          timeout,
          intervaloPing,
          now,
          ipId,
          unitId
        ]
      );

      await logEvent(
        LogLevel.INFO,
        "Unidades",
        "Modificación IP",
        `IP ${direccionIP} en unidad ${unitId} actualizada.`
      );

      res.json({ message: "IP updated successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteUnitIp(req: Request, res: Response) {
    try {
      const unitId = parseInt(req.params.id);
      const ipId = parseInt(req.params.ipId);

      const ipInfo = await query.get<any>(
        "SELECT direccionIP FROM unit_ips WHERE id = ? AND unitId = ?",
        [ipId, unitId]
      );

      if (!ipInfo) {
        return res.status(404).json({ error: "IP not found" });
      }

      await query.run("DELETE FROM unit_ips WHERE id = ? AND unitId = ?", [ipId, unitId]);

      await logEvent(
        LogLevel.WARNING,
        "Unidades",
        "Baja IP",
        `IP ${ipInfo.direccionIP} eliminada de la unidad ${unitId}.`
      );

      res.json({ message: "IP deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateUnit(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nombre, activo, motivoPausa } = req.body;

      const unit = await query.get<any>("SELECT id, nombre, activo FROM units WHERE id = ?", [id]);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }

      const now = new Date().toISOString();

      await query.transaction(async () => {
        if (nombre !== undefined && nombre.trim() !== "") {
          await query.run(
            `UPDATE units SET nombre = ?, ultimaActualizacion = ? WHERE id = ?`,
            [nombre.trim(), now, id]
          );
          await logEvent(
            LogLevel.INFO,
            "Unidades",
            "Modificación Nombre",
            `Nombre de la unidad ID ${id} cambiado de "${unit.nombre}" a "${nombre.trim()}".`
          );
        }

        if (activo !== undefined) {
          const finalMotivo = activo ? null : (motivoPausa ? String(motivoPausa).trim() : "Sin motivo especificado");
          await query.run(
            `UPDATE units SET activo = ?, motivoPausa = ?, ultimaActualizacion = ? WHERE id = ?`,
            [activo ? 1 : 0, finalMotivo, now, id]
          );

          if (!activo) {
            await query.run(
              `DELETE FROM ticket_details WHERE ticketId IN (SELECT id FROM tickets WHERE unitId = ?)`,
              [id]
            );
            await query.run(
              `DELETE FROM tickets WHERE unitId = ?`,
              [id]
            );
          }

          const action = activo ? "Reanudación" : "Pausa";
          const reasonDetail = !activo ? ` Motivo: ${finalMotivo}` : "";
          await logEvent(
            LogLevel.WARNING,
            "Unidades",
            `Monitoreo ${action}`,
            `Monitoreo de la unidad ${nombre || unit.nombre} (ID ${id}) ha sido ${activo ? "reanudado" : "pausado"}.${reasonDetail}`
          );
        }
      });

      await syncCatalogs();

      res.json({ message: "Unit updated successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteUnit(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      const unit = await query.get<any>("SELECT id, nombre FROM units WHERE id = ?", [id]);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }

      await query.transaction(async () => {
        // 1. Delete ticket details associated with this unit's tickets
        await query.run(
          `DELETE FROM ticket_details WHERE ticketId IN (SELECT id FROM tickets WHERE unitId = ?)`,
          [id]
        );
        
        // 2. Delete tickets associated with this unit
        await query.run(`DELETE FROM tickets WHERE unitId = ?`, [id]);
        
        // 3. Delete the unit itself (cascade deletes rooms and unit_ips automatically)
        await query.run(`DELETE FROM units WHERE id = ?`, [id]);
      });

      await logEvent(
        LogLevel.WARNING,
        "Unidades",
        "Baja Unidad",
        `Unidad ${unit.nombre} (ID ${id}) eliminada permanentemente del sistema.`
      );

      await syncCatalogs();

      res.json({ message: "Unit deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createUnit(req: Request, res: Response) {
    try {
      const { id, nombre, cityId, tipo } = req.body;
      
      if (!id || !nombre || !cityId || !tipo) {
        return res.status(400).json({ error: "Missing required fields: id, nombre, cityId, tipo" });
      }

      const unitId = parseInt(id);
      if (isNaN(unitId) || unitId <= 0) {
        return res.status(400).json({ error: "Official ID must be a positive integer" });
      }

      const existing = await query.get("SELECT id FROM units WHERE id = ?", [unitId]);
      if (existing) {
        return res.status(400).json({ error: `A unit with Official ID ${unitId} already exists` });
      }

      const now = new Date().toISOString();
      await query.run(
        `INSERT INTO units (id, nombre, cityId, tipo, activo, fechaImportacion, ultimaActualizacion)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        [unitId, nombre.trim(), cityId, tipo, now, now]
      );

      await logEvent(
        LogLevel.INFO,
        "Unidades",
        "Alta Unidad",
        `Unidad ${nombre} (ID ${unitId}) registrada manualmente.`
      );

      await syncCatalogs();

      res.status(201).json({ message: "Unit created successfully", unitId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createRoom(req: Request, res: Response) {
    try {
      const unitId = parseInt(req.params.id);
      const { nombre } = req.body;

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({ error: "Missing required 'nombre' field in request body" });
      }

      const unit = await query.get<any>("SELECT id, nombre FROM units WHERE id = ?", [unitId]);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }

      const existing = await query.get(
        "SELECT id FROM rooms WHERE unitId = ? AND nombre = ?",
        [unitId, nombre.trim()]
      );
      if (existing) {
        return res.status(400).json({ error: `Room "${nombre.trim()}" already exists for this unit` });
      }

      const countRes = await query.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM rooms WHERE unitId = ?",
        [unitId]
      );
      const nextIndex = (countRes?.count || 0) + 1;
      const roomId = `R-${unitId}-${nextIndex}-${Date.now().toString().slice(-4)}`;

      const now = new Date().toISOString();
      await query.run(
        `INSERT INTO rooms (id, unitId, nombre, fechaImportacion, ultimaActualizacion) VALUES (?, ?, ?, ?, ?)`,
        [roomId, unitId, nombre.trim(), now, now]
      );

      await logEvent(
        LogLevel.INFO,
        "Unidades",
        "Alta Cuarto",
        `Cuarto de enlace "${nombre.trim()}" (ID ${roomId}) agregado a la unidad "${unit.nombre}" (ID ${unitId}).`
      );

      await syncCatalogs();

      res.status(201).json({ message: "Room added successfully", roomId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteRoom(req: Request, res: Response) {
    try {
      const unitId = parseInt(req.params.id);
      const roomId = req.params.roomId;

      const room = await query.get<any>(
        "SELECT nombre FROM rooms WHERE id = ? AND unitId = ?",
        [roomId, unitId]
      );
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      await query.run("DELETE FROM rooms WHERE id = ? AND unitId = ?", [roomId, unitId]);

      await logEvent(
        LogLevel.WARNING,
        "Unidades",
        "Baja Cuarto",
        `Cuarto de enlace "${room.nombre}" (ID ${roomId}) eliminado de la unidad ID ${unitId}.`
      );

      await syncCatalogs();

      res.json({ message: "Room deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async checkUnitIp(req: Request, res: Response) {
    try {
      const unitId = parseInt(req.params.id);
      const ipId = parseInt(req.params.ipId);

      const ipInfo = await query.get<any>(
        "SELECT id, direccionIP, descripcion, timeout FROM unit_ips WHERE id = ? AND unitId = ?",
        [ipId, unitId]
      );

      if (!ipInfo) {
        return res.status(404).json({ error: "IP not found for this unit" });
      }

      // Fetch global timeout setting if not specified on IP
      const settings = await query.get<any>("SELECT timeout FROM settings WHERE id = 1");
      const timeout = ipInfo.timeout || (settings ? settings.timeout : 1000);

      // Ping
      const pingResult = await PingExecutor.ping(ipInfo.direccionIP, timeout);

      // Save to history
      const nowISO = new Date().toISOString();
      await query.run(
        `INSERT INTO ping_history (ipId, fechaHora, resultado, latencia, mensajeError)
         VALUES (?, ?, ?, ?, ?)`,
        [ipInfo.id, nowISO, pingResult.status, pingResult.latency, pingResult.errorMsg]
      );

      // Evaluate ticket status
      await evaluateUnitTicketsDb(unitId, ipInfo.id, pingResult.status, ipInfo.direccionIP, ipInfo.descripcion);

      res.json({
        success: true,
        status: pingResult.status,
        latency: pingResult.latency,
        errorMsg: pingResult.errorMsg
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async checkAllUnitIps(req: Request, res: Response) {
    try {
      const unitId = parseInt(req.params.id);
      const unit = await query.get<any>("SELECT id FROM units WHERE id = ?", [unitId]);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }

      const ips = await query.all<any>(
        "SELECT id, direccionIP, descripcion, timeout, esCritica FROM unit_ips WHERE unitId = ? AND activa = 1",
        [unitId]
      );

      if (ips.length === 0) {
        return res.json({ success: true, checked: 0, results: [] });
      }

      const settings = await query.get<any>("SELECT timeout FROM settings WHERE id = 1");
      const defTimeout = settings ? settings.timeout : 1000;

      const results = [];
      for (const ip of ips) {
        const timeout = ip.timeout || defTimeout;
        const pingResult = await PingExecutor.ping(ip.direccionIP, timeout);
        const nowISO = new Date().toISOString();
        
        await query.run(
          `INSERT INTO ping_history (ipId, fechaHora, resultado, latencia, mensajeError)
           VALUES (?, ?, ?, ?, ?)`,
          [ip.id, nowISO, pingResult.status, pingResult.latency, pingResult.errorMsg]
        );

        await evaluateUnitTicketsDb(unitId, ip.id, pingResult.status, ip.direccionIP, ip.descripcion);

        results.push({
          ipId: ip.id,
          direccionIP: ip.direccionIP,
          status: pingResult.status,
          latency: pingResult.latency,
          errorMsg: pingResult.errorMsg
        });
      }

      res.json({
        success: true,
        checked: ips.length,
        results
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

// Utility function to calculate availability
async function calculateAvailability(unitId: number): Promise<number> {
  try {
    const daysInMonth = 30;
    const totalSeconds = daysInMonth * 24 * 60 * 60; // 2,592,000 seconds
    
    // Sum total downtime in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - daysInMonth);
    const year = thirtyDaysAgo.getFullYear();
    const month = String(thirtyDaysAgo.getMonth() + 1).padStart(2, "0");
    const day = String(thirtyDaysAgo.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    const downtimeRow = await query.get<{ totalDowntime: number }>(
      `SELECT SUM(
        CASE 
          WHEN fechaFin IS NULL THEN strftime('%s', 'now') - strftime('%s', fechaInicio || ' ' || horaInicio, 'utc')
          ELSE duracionSegundos 
        END
       ) AS totalDowntime
       FROM tickets 
       WHERE unitId = ? AND fechaInicio >= ?`,
      [unitId, dateStr]
    );

    const downtime = downtimeRow?.totalDowntime || 0;
    if (downtime >= totalSeconds) return 0.00;
    
    const availability = ((totalSeconds - downtime) / totalSeconds) * 100;
    return parseFloat(availability.toFixed(2));
  } catch {
    return 100.00;
  }
}

interface PingResult {
  status: "ONLINE" | "OFFLINE";
  latency: number | null;
  errorMsg: string | null;
}

class PingExecutor {
  static ping(ip: string, timeoutMs: number = 1000): Promise<PingResult> {
    return new Promise((resolve) => {
      const process = spawn("ping.exe", ["-n", "1", "-w", timeoutMs.toString(), ip]);
      let stdoutData = "";
      let stderrData = "";

      process.stdout.on("data", (data) => {
        stdoutData += data.toString("latin1");
      });

      process.stderr.on("data", (data) => {
        stderrData += data.toString();
      });

      process.on("close", (code) => {
        if (code !== 0 && stderrData.length > 0) {
          return resolve({
            status: "OFFLINE",
            latency: null,
            errorMsg: `Execution error: ${stderrData.trim()}`
          });
        }

        const latencyMatch = stdoutData.match(/(?:tiempo|time)(?:=|<)(\d+)ms/i);

        if (latencyMatch) {
          const latency = parseInt(latencyMatch[1]);
          return resolve({
            status: "ONLINE",
            latency: latency === 0 ? 1 : latency,
            errorMsg: null
          });
        }

        let errorMsg = "Falla de comunicación";
        if (stdoutData.toLowerCase().includes("espera agotado") || stdoutData.toLowerCase().includes("timed out")) {
          errorMsg = "Timeout";
        } else if (stdoutData.toLowerCase().includes("inaccesible") || stdoutData.toLowerCase().includes("unreachable")) {
          errorMsg = "Host inaccesible";
        } else if (stdoutData.toLowerCase().includes("desconocido") || stdoutData.toLowerCase().includes("unknown")) {
          errorMsg = "Destino desconocido";
        } else {
          const lines = stdoutData.split("\n").map(l => l.trim()).filter(l => l.length > 0);
          const errorLine = lines.find(l => l.includes("perdid") || l.includes("lost") || l.includes("error") || l.includes("fallo"));
          if (errorLine) {
            errorMsg = errorLine;
          }
        }

        resolve({
          status: "OFFLINE",
          latency: null,
          errorMsg
        });
      });
    });
  }
}

async function generateFolio(dateStr: string): Promise<string> {
  const year = dateStr.substring(0, 4);
  const pattern = `SME-${year}%`;
  const maxRow = await query.get<any>(
    `SELECT folio AS maxFolio FROM tickets 
     WHERE folio LIKE ? 
     ORDER BY id DESC LIMIT 1`,
    [pattern]
  );

  let nextSeq = 1;
  if (maxRow && maxRow.maxFolio) {
    const parts = maxRow.maxFolio.split("-");
    const lastSeq = parseInt(parts[2]);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  const seqStr = nextSeq.toString().padStart(6, "0");
  return `SME-${dateStr}-${seqStr}`;
}

async function evaluateUnitTicketsDb(unitId: number, checkedIpId: number, pingResult: string, ipAddress: string, ipDesc: string) {
  // 1. Fetch active ticket for the unit
  const activeTicket = await query.get<any>(
    "SELECT id, folio FROM tickets WHERE unitId = ? AND estado = 'Abierto'",
    [unitId]
  );

  // 2. If pingResult is OFFLINE:
  if (pingResult === "OFFLINE") {
    if (!activeTicket) {
      // Create new ticket
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      const dateCompact = dateStr.replace(/-/g, "");
      const timeStr = now.toTimeString().substring(0, 8);

      const folio = await generateFolio(dateCompact);
      const reason = `[Manual] Caída detectada en enlace: ${ipAddress} (${ipDesc})`;

      const ticketResult = await query.run(
        `INSERT INTO tickets (folio, unitId, fechaInicio, horaInicio, estado, motivo, creadoAutomaticamente)
         VALUES (?, ?, ?, ?, 'Abierto', ?, 1)`,
        [folio, unitId, dateStr, timeStr, reason]
      );
      const ticketId = ticketResult.lastID;

      await query.run(
        `INSERT INTO ticket_details (ticketId, ipId, descripcion, estadoInicial, estadoFinal)
         VALUES (?, ?, ?, 'OFFLINE', NULL)`,
        [ticketId, checkedIpId, ipDesc]
      );

      await logEvent(
        LogLevel.WARNING,
        "Tickets",
        "Apertura Ticket",
        `Ticket autogenerado manualmente con Folio ${folio} para unidad ID ${unitId} por caída de IP ${ipAddress}.`
      );
    } else {
      // There is an active ticket, check if this IP is already in its details
      const existingDetail = await query.get<any>(
        "SELECT id FROM ticket_details WHERE ticketId = ? AND ipId = ?",
        [activeTicket.id, checkedIpId]
      );
      if (!existingDetail) {
        await query.run(
          `INSERT INTO ticket_details (ticketId, ipId, descripcion, estadoInicial, estadoFinal)
           VALUES (?, ?, ?, 'OFFLINE', NULL)`,
          [activeTicket.id, checkedIpId, ipDesc]
        );
      }
    }
  } else {
    // If pingResult is ONLINE, and there is an active ticket:
    if (activeTicket) {
      // Mark this IP as ONLINE in ticket_details if it was recorded
      await query.run(
        `UPDATE ticket_details SET estadoFinal = 'ONLINE' WHERE ticketId = ? AND ipId = ? AND estadoFinal IS NULL`,
        [activeTicket.id, checkedIpId]
      );

      // Check if ALL critical IPs of the unit are ONLINE
      const criticalIps = await query.all<any>(
        "SELECT id FROM unit_ips WHERE unitId = ? AND activa = 1 AND esCritica = 1",
        [unitId]
      );
      
      let allCriticalIpsUp = true;
      for (const critIp of criticalIps) {
        const lastPing = await query.get<any>(
          "SELECT resultado FROM ping_history WHERE ipId = ? ORDER BY id DESC LIMIT 1",
          [critIp.id]
        );
        if (!lastPing || lastPing.resultado === "OFFLINE") {
          allCriticalIpsUp = false;
          break;
        }
      }

      if (allCriticalIpsUp) {
        // Close the ticket!
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;
        const timeStr = now.toTimeString().substring(0, 8);

        let duracionSegundos = 0;
        const ticketInfo = await query.get<any>(
          "SELECT fechaInicio, horaInicio, folio FROM tickets WHERE id = ?",
          [activeTicket.id]
        );
        if (ticketInfo) {
          try {
            const start = new Date(`${ticketInfo.fechaInicio}T${ticketInfo.horaInicio}`);
            duracionSegundos = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
          } catch (e) {
            console.error(e);
          }
        }

        await query.transaction(async () => {
          await query.run(
            `UPDATE ticket_details SET estadoFinal = 'ONLINE' WHERE ticketId = ? AND estadoFinal IS NULL`,
            [activeTicket.id]
          );
          await query.run(
            `UPDATE tickets SET estado = 'Cerrado', fechaFin = ?, horaFin = ?, duracionSegundos = ? WHERE id = ?`,
            [dateStr, timeStr, duracionSegundos, activeTicket.id]
          );
        });

        await logEvent(
          LogLevel.INFO,
          "Tickets",
          "Cierre Ticket",
          `Ticket Folio ${ticketInfo?.folio || activeTicket.folio} cerrado automáticamente tras recuperación manual del enlace.`
        );
      }
    }
  }
}

