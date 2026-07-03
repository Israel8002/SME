import { z } from "zod";

// Core Enums
export type CityId = "MXL" | "TIJ" | "ENS" | "SLRC" | "TKT";

export const CityIdSchema = z.enum(["MXL", "TIJ", "ENS", "SLRC", "TKT"]);

export const UnitTypeSchema = z.enum([
  "Hospital Regional",
  "Hospital General",
  "Hospital General de Zona",
  "Hospital General Subzona",
  "Hospital General Regional",
  "Hospital Gineco Pediatría",
  "Hospital COVID",
  "UMF",
  "Subdelegación",
  "Oficinas",
  "Centro de Seguridad Social",
  "Centro de Capacitación",
  "Guardería",
  "Almacén",
  "Bodega",
  "Periférico",
  "Tienda",
  "Teatro",
  "Escuela",
  "UDDCM",
  "Centro CAPA",
  "Hospital",
  "Unidad",
  "Parque",
  "Centro de Mezclas",
  "Otro"
]);

export type UnitType = z.infer<typeof UnitTypeSchema>;

// Entities
export interface City {
  id: CityId;
  nombre: string;
}

export const CitySchema = z.object({
  id: CityIdSchema,
  nombre: z.string().min(1)
});

export interface Unit {
  id: number;
  nombre: string;
  cityId: CityId;
  tipo: UnitType;
  activo: boolean;
  motivoPausa?: string | null;
}

export const UnitSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string().min(1),
  cityId: CityIdSchema,
  tipo: UnitTypeSchema.or(z.string().min(1)), // Flexibly allow other strings
  activo: z.boolean(),
  motivoPausa: z.string().nullable().optional()
});

export interface Room {
  id?: string;
  unitId: number;
  nombre: string;
}

export const RoomSchema = z.object({
  id: z.string().optional(),
  unitId: z.number().int().positive(),
  nombre: z.string().min(1)
});

// Helper validation schema for raw rooms input (which might use 'unidadId' instead of 'unitId')
export const RawRoomImportSchema = z.object({
  nombre: z.string().min(1),
  unidadId: z.number().int().positive().optional(),
  unitId: z.number().int().positive().optional()
}).refine(data => data.unidadId !== undefined || data.unitId !== undefined, {
  message: "Debe especificarse unidadId o unitId"
});

// Unit IP Configurations
export interface UnitIP {
  id?: number;
  unitId: number;
  direccionIP: string;
  descripcion: string;
  esCritica: boolean;
  activa: boolean;
  timeout: number | null;
  intervaloPing: number | null;
  fechaAlta: string;
  ultimaModificacion: string;
}

export const UnitIPSchema = z.object({
  id: z.number().int().optional(),
  unitId: z.number().int(),
  direccionIP: z.string().ip({ version: "v4" }),
  descripcion: z.string().min(1),
  esCritica: z.boolean().default(false),
  activa: z.boolean().default(true),
  timeout: z.number().int().positive().nullable().default(null),
  intervaloPing: z.number().int().positive().nullable().default(null),
  fechaAlta: z.string().optional(),
  ultimaModificacion: z.string().optional()
});

// Tickets
export interface Ticket {
  id?: number;
  folio: string;
  unitId: number;
  fechaInicio: string;
  horaInicio: string;
  fechaFin: string | null;
  horaFin: string | null;
  duracionSegundos: number;
  estado: "Abierto" | "Cerrado";
  motivo: string;
  observaciones: string | null;
  creadoAutomaticamente: boolean;
}

// Global Settings
export interface Settings {
  intervaloPing: number;
  fallosConsecutivos: number;
  recuperacionesConsecutivas: number;
  timeout: number;
  rutaRespaldos: string;
  rutaExportaciones: string;
  nombreInstitucion: string;
  logo: string | null;
  actualizacionAutomatica: boolean;
}

export const SettingsSchema = z.object({
  intervaloPing: z.number().int().min(5).max(3600),
  fallosConsecutivos: z.number().int().min(1).max(100),
  recuperacionesConsecutivas: z.number().int().min(1).max(100),
  timeout: z.number().int().min(100).max(10000),
  rutaRespaldos: z.string().min(1),
  rutaExportaciones: z.string().min(1),
  nombreInstitucion: z.string().min(1),
  logo: z.string().nullable().default(null),
  actualizacionAutomatica: z.boolean().default(true)
});
