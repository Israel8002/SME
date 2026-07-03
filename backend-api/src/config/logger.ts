import { query } from "./db";

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL"
}

export async function logEvent(
  nivel: LogLevel,
  modulo: string,
  evento: string,
  descripcion: string,
  usuario: string | null = "Sistema",
  ipEquipo: string | null = "127.0.0.1"
) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${nivel}] [${modulo}] ${evento}: ${descripcion}`);

  try {
    await query.run(
      `INSERT INTO logs (fechaHora, nivel, modulo, evento, descripcion, usuario, ipEquipo, versionSistema)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [timestamp, nivel, modulo, evento, descripcion, usuario, ipEquipo, "1.0.0"]
    );
  } catch (err: any) {
    console.error("Failed to write to database logs table:", err.message);
  }
}
