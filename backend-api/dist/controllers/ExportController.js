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
exports.ExportController = void 0;
const db_1 = require("../config/db");
const logger_1 = require("../config/logger");
const exceljs_1 = __importDefault(require("exceljs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const TicketController_1 = require("./TicketController");
const WORKSPACE_DIR = path.resolve(__dirname, "../../../");
const EXPORTS_DIR = path.join(WORKSPACE_DIR, "exports");
class ExportController {
    static async exportData(req, res) {
        const type = req.query.type; // 'tickets', 'units', 'logs'
        const format = req.query.format; // 'pdf', 'excel', 'csv'
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        if (!["tickets", "units", "logs"].includes(type)) {
            return res.status(400).json({ error: "Invalid export type" });
        }
        if (!["pdf", "excel", "csv"].includes(format)) {
            return res.status(400).json({ error: "Invalid export format" });
        }
        if (!fs.existsSync(EXPORTS_DIR)) {
            fs.mkdirSync(EXPORTS_DIR, { recursive: true });
        }
        try {
            let data = [];
            let filename = "";
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            const dateStr = `${year}-${month}-${day}`;
            const timeStr = now.toTimeString().substring(0, 8).replace(/:/g, "");
            if (type === "tickets") {
                let sql = `
          SELECT t.*, u.nombre AS unidadNombre, c.nombre AS ciudadNombre, u.tipo AS unidadTipo 
          FROM tickets t
          JOIN units u ON t.unitId = u.id
          JOIN cities c ON u.cityId = c.id
        `;
                const params = [];
                if (startDate && endDate) {
                    sql += ` WHERE t.fechaInicio >= ? AND t.fechaInicio <= ?`;
                    params.push(startDate, endDate);
                }
                else if (startDate) {
                    sql += ` WHERE t.fechaInicio >= ?`;
                    params.push(startDate);
                }
                else if (endDate) {
                    sql += ` WHERE t.fechaInicio <= ?`;
                    params.push(endDate);
                }
                sql += ` ORDER BY t.id DESC`;
                data = await db_1.query.all(sql, params);
                filename = `Reporte_Tickets_${dateStr}_${timeStr}`;
            }
            else if (type === "units") {
                const units = await db_1.query.all(`
          SELECT u.*, c.nombre AS ciudadNombre
          FROM units u
          JOIN cities c ON u.cityId = c.id
          ORDER BY u.id ASC
        `);
                const ips = await db_1.query.all(`
          SELECT unitId, direccionIP, esCritica
          FROM unit_ips
          ORDER BY unitId ASC, esCritica DESC, direccionIP ASC
        `);
                units.forEach(u => {
                    const unitIps = ips.filter(ip => ip.unitId === u.id);
                    u.segmentosRed = unitIps.map(ip => ip.direccionIP).join("\n");
                });
                data = units;
                filename = `Reporte_Unidades_${dateStr}_${timeStr}`;
            }
            else if (type === "logs") {
                data = await db_1.query.all("SELECT * FROM logs ORDER BY id DESC LIMIT 500"); // Cap at 500 for export
                filename = `Reporte_Logs_${dateStr}_${timeStr}`;
            }
            // Record export log
            const logExport = async (success, filePath) => {
                const today = dateStr;
                const timeNow = now.toTimeString().substring(0, 8);
                await db_1.query.run(`INSERT INTO exports (tipo, fecha, hora, usuario, ruta, resultado)
           VALUES (?, ?, ?, 'Administrador', ?, ?)`, [format.toUpperCase(), today, timeNow, filePath, success ? "EXITOSO" : "FALLIDO"]);
                await (0, logger_1.logEvent)(logger_1.LogLevel.INFO, "Exportaciones", format.toUpperCase(), `Exportación de ${type} realizada exitosamente en formato ${format.toUpperCase()}.`);
            };
            if (format === "csv") {
                const filePath = path.join(EXPORTS_DIR, `${filename}.csv`);
                const csvContent = generateCSV(type, data);
                fs.writeFileSync(filePath, csvContent, "utf8");
                await logExport(true, filePath);
                res.setHeader("Content-Type", "text/csv");
                res.setHeader("Content-Disposition", `attachment; filename=${filename}.csv`);
                return res.send(csvContent);
            }
            else if (format === "excel") {
                const filePath = path.join(EXPORTS_DIR, `${filename}.xlsx`);
                const workbook = await generateExcel(type, data);
                await workbook.xlsx.writeFile(filePath);
                await logExport(true, filePath);
                res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                res.setHeader("Content-Disposition", `attachment; filename=${filename}.xlsx`);
                return workbook.xlsx.write(res);
            }
            else if (format === "pdf") {
                const filePath = path.join(EXPORTS_DIR, `${filename}.pdf`);
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `attachment; filename=${filename}.pdf`);
                const doc = new pdfkit_1.default({ margin: 30, size: "A4" });
                // Stream to file
                const writeStream = fs.createWriteStream(filePath);
                doc.pipe(writeStream);
                // Stream to HTTP response
                doc.pipe(res);
                generatePDF(doc, type, data);
                doc.end();
                writeStream.on("finish", async () => {
                    await logExport(true, filePath);
                });
            }
        }
        catch (error) {
            console.error("Export failure:", error.message);
            res.status(500).json({ error: error.message });
        }
    }
    static async getExportHistory(req, res) {
        try {
            const history = await db_1.query.all("SELECT * FROM exports ORDER BY id DESC");
            res.json(history);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.ExportController = ExportController;
function generateCSV(type, data) {
    let headers = [];
    let rows = [];
    if (type === "tickets") {
        headers = ["Folio", "Ticket Proveedor", "Unidad", "Ciudad", "Tipo", "Inicio", "Fin", "Duración", "Estado", "Motivo"];
        rows = data.map(t => [
            t.folio,
            t.ticketProveedor || "No asignado",
            t.unidadNombre,
            t.ciudadNombre,
            t.unidadTipo,
            `${t.fechaInicio} ${t.horaInicio}`,
            t.fechaFin ? `${t.fechaFin} ${t.horaFin}` : "Abierto",
            formatDurationExport(t.duracionSegundos),
            t.estado,
            t.motivo
        ]);
    }
    else if (type === "units") {
        headers = ["ID Oficial", "Nombre de la Unidad", "Ciudad", "Tipo", "Activo", "Segmentos de Red"];
        rows = data.map(u => [
            u.id.toString(),
            u.nombre,
            u.ciudadNombre,
            u.tipo,
            u.activo === 1 ? "Si" : "No",
            u.segmentosRed || "Sin segmento"
        ]);
    }
    else if (type === "logs") {
        headers = ["Fecha/Hora", "Nivel", "Modulo", "Evento", "Descripcion", "Usuario", "IP Equipo"];
        rows = data.map(l => [
            l.fechaHora,
            l.nivel,
            l.modulo,
            l.evento,
            l.descripcion,
            l.usuario || "Sistema",
            l.ipEquipo || "127.0.0.1"
        ]);
    }
    const csvRows = [
        headers.join(","),
        ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
    ];
    return "\ufeff" + csvRows.join("\n"); // Add UTF-8 BOM
}
async function generateExcel(type, data) {
    const workbook = new exceljs_1.default.Workbook();
    const sheet = workbook.addWorksheet("Reporte SME");
    // Style helper
    const headerFont = { name: "Segoe UI", bold: true, color: { argb: "FFFFFF" }, size: 11 };
    const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "0B3C5D" } };
    const borderStyle = {
        top: { style: "thin", color: { argb: "D3D3D3" } },
        left: { style: "thin", color: { argb: "D3D3D3" } },
        bottom: { style: "thin", color: { argb: "D3D3D3" } },
        right: { style: "thin", color: { argb: "D3D3D3" } }
    };
    if (type === "tickets") {
        sheet.columns = [
            { header: "Folio", key: "folio", width: 22 },
            { header: "Ticket Proveedor", key: "ticketProveedor", width: 22 },
            { header: "Unidad", key: "unidad", width: 30 },
            { header: "Ciudad", key: "ciudad", width: 18 },
            { header: "Tipo de Unidad", key: "tipo", width: 22 },
            { header: "Fecha Inicio", key: "inicio", width: 22 },
            { header: "Fecha Fin/Cierre", key: "fin", width: 22 },
            { header: "Duración", key: "duracion", width: 24 },
            { header: "Estado", key: "estado", width: 14 },
            { header: "Motivo", key: "motivo", width: 35 }
        ];
        data.forEach(t => {
            sheet.addRow({
                folio: t.folio,
                ticketProveedor: t.ticketProveedor || "No asignado",
                unidad: t.unidadNombre,
                ciudad: t.ciudadNombre,
                tipo: t.unidadTipo,
                inicio: `${t.fechaInicio} ${t.horaInicio}`,
                fin: t.fechaFin ? `${t.fechaFin} ${t.horaFin}` : "Abierto",
                duracion: formatDurationExport(t.duracionSegundos),
                estado: t.estado,
                motivo: t.motivo
            });
        });
    }
    else if (type === "units") {
        sheet.columns = [
            { header: "ID Oficial", key: "id", width: 15 },
            { header: "Nombre de Unidad", key: "nombre", width: 35 },
            { header: "Ciudad", key: "ciudad", width: 20 },
            { header: "Tipo", key: "tipo", width: 25 },
            { header: "Activo", key: "activo", width: 12 },
            { header: "Segmento(s) de Red", key: "segmentos", width: 45 }
        ];
        data.forEach(u => {
            sheet.addRow({
                id: u.id,
                nombre: u.nombre,
                ciudad: u.ciudadNombre,
                tipo: u.tipo,
                activo: u.activo === 1 ? "Sí" : "No",
                segmentos: u.segmentosRed || "Sin segmento"
            });
        });
    }
    else if (type === "logs") {
        sheet.columns = [
            { header: "Fecha/Hora", key: "fecha", width: 24 },
            { header: "Nivel", key: "nivel", width: 14 },
            { header: "Módulo", key: "modulo", width: 18 },
            { header: "Evento", key: "evento", width: 20 },
            { header: "Descripción", key: "desc", width: 55 },
            { header: "Usuario", key: "usuario", width: 16 },
            { header: "IP Equipo", key: "ip", width: 16 }
        ];
        data.forEach(l => {
            sheet.addRow({
                fecha: l.fechaHora,
                nivel: l.nivel,
                modulo: l.modulo,
                evento: l.evento,
                desc: l.descripcion,
                usuario: l.usuario || "Sistema",
                ip: l.ipEquipo || "127.0.0.1"
            });
        });
    }
    // Format Header row
    const firstRow = sheet.getRow(1);
    firstRow.height = 25;
    firstRow.eachCell(cell => {
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = borderStyle;
    });
    // Apply cell formatting to data rows
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1)
            return;
        row.eachCell(cell => {
            cell.font = { name: "Segoe UI", size: 10 };
            cell.alignment = { vertical: "middle" };
            cell.border = borderStyle;
        });
    });
    return workbook;
}
function generatePDF(doc, type, data) {
    // Title
    doc.font("Helvetica-Bold").fontSize(18).text("SISTEMA DE MONITOREO DE ENLACES (SME)", { align: "center" });
    doc.fontSize(11).font("Helvetica").text("IMSS Órgano de Operación Administrativa Desconcentrada BC", { align: "center" });
    doc.fontSize(9).text(`Fecha de Emisión: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(1.5);
    doc.font("Helvetica-Bold").fontSize(14).text(`Reporte Oficial de ${type.toUpperCase()}`, { underline: true });
    doc.moveDown(1);
    // Table header
    let y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9);
    if (type === "tickets") {
        // Columns: Folio(80), Unidad(120), Ciudad(60), Inicio(85), Estado(50), Duracion(65), TicketProv(70)
        doc.text("Folio", 30, y);
        doc.text("Unidad", 110, y);
        doc.text("Ciudad", 230, y);
        doc.text("Inicio", 290, y);
        doc.text("Estado", 375, y);
        doc.text("Duración", 425, y);
        doc.text("Ticket Prov.", 490, y);
        y += 15;
        doc.moveTo(30, y).lineTo(560, y).stroke();
        y += 8;
        doc.font("Helvetica").fontSize(7.5);
        data.forEach(t => {
            if (y > 750) {
                doc.addPage();
                y = 50;
            }
            const durationText = (0, TicketController_1.formatDuration)(t.duracionSegundos, t.estado === "Abierto", t.fechaInicio, t.horaInicio);
            doc.text(t.folio, 30, y);
            doc.text(t.unidadNombre.substring(0, 20), 110, y, { width: 115, ellipsis: true });
            doc.text(t.ciudadNombre, 230, y, { width: 55, ellipsis: true });
            doc.text(`${t.fechaInicio} ${t.horaInicio.substring(0, 5)}`, 290, y);
            doc.text(t.estado, 375, y);
            doc.text(durationText, 425, y, { width: 60, ellipsis: true });
            doc.text(t.ticketProveedor || "-", 490, y, { width: 70, ellipsis: true });
            y += 18;
        });
    }
    else if (type === "units") {
        // Columns: ID(30), Nombre(70), Ciudad(220), Tipo(290), Segmentos(370)
        doc.text("ID", 30, y);
        doc.text("Nombre de la Unidad", 70, y);
        doc.text("Ciudad", 220, y);
        doc.text("Tipo", 290, y);
        doc.text("Segmento(s) de Red", 370, y);
        y += 15;
        doc.moveTo(30, y).lineTo(560, y).stroke();
        y += 8;
        doc.font("Helvetica").fontSize(8);
        data.forEach(u => {
            const segmentosText = u.segmentosRed || "Sin segmento";
            const textHeight = doc.heightOfString(segmentosText, { width: 190 });
            const rowHeight = Math.max(18, textHeight + 4);
            if (y + rowHeight > 750) {
                doc.addPage();
                y = 50;
            }
            doc.text(u.id.toString(), 30, y, { width: 35, ellipsis: true });
            doc.text(u.nombre, 70, y, { width: 145, ellipsis: true });
            doc.text(u.ciudadNombre, 220, y, { width: 65, ellipsis: true });
            doc.text(u.tipo, 290, y, { width: 75, ellipsis: true });
            doc.text(segmentosText, 370, y, { width: 190 });
            y += rowHeight;
        });
    }
    else if (type === "logs") {
        // Columns: Fecha(110), Nivel(60), Modulo(80), Evento(100), Desc(180)
        doc.text("Fecha / Hora", 30, y);
        doc.text("Nivel", 140, y);
        doc.text("Módulo", 200, y);
        doc.text("Evento", 280, y);
        doc.text("Descripción", 370, y);
        y += 15;
        doc.moveTo(30, y).lineTo(560, y).stroke();
        y += 8;
        doc.font("Helvetica").fontSize(7.5);
        data.forEach(l => {
            if (y > 750) {
                doc.addPage();
                y = 50;
            }
            doc.text(l.fechaHora.substring(0, 19).replace("T", " "), 30, y);
            doc.text(l.nivel, 140, y);
            doc.text(l.modulo, 200, y);
            doc.text(l.evento, 280, y);
            doc.text(l.descripcion.substring(0, 42), 370, y);
            y += 16;
        });
    }
}
function formatDurationExport(seconds) {
    if (!seconds || seconds <= 0)
        return "0 Seg";
    const days = Math.floor(seconds / (24 * 3600));
    let remaining = seconds % (24 * 3600);
    const hours = Math.floor(remaining / 3600);
    remaining %= 3600;
    const minutes = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const parts = [];
    if (days > 0) {
        parts.push(`${days} Día${days > 1 ? "s" : ""}`);
    }
    if (hours > 0) {
        parts.push(`${hours} Hrs`);
    }
    if (minutes > 0) {
        parts.push(`${minutes} Min`);
    }
    if (secs > 0 || parts.length === 0) {
        parts.push(`${secs} Seg`);
    }
    return parts.join(" ");
}
