"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsSchema = exports.UnitIPSchema = exports.RawRoomImportSchema = exports.RoomSchema = exports.UnitSchema = exports.CitySchema = exports.UnitTypeSchema = exports.CityIdSchema = void 0;
const zod_1 = require("zod");
exports.CityIdSchema = zod_1.z.enum(["MXL", "TIJ", "ENS", "SLRC", "TKT"]);
exports.UnitTypeSchema = zod_1.z.enum([
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
exports.CitySchema = zod_1.z.object({
    id: exports.CityIdSchema,
    nombre: zod_1.z.string().min(1)
});
exports.UnitSchema = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    nombre: zod_1.z.string().min(1),
    cityId: exports.CityIdSchema,
    tipo: exports.UnitTypeSchema.or(zod_1.z.string().min(1)), // Flexibly allow other strings
    activo: zod_1.z.boolean(),
    motivoPausa: zod_1.z.string().nullable().optional()
});
exports.RoomSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    unitId: zod_1.z.number().int().positive(),
    nombre: zod_1.z.string().min(1)
});
// Helper validation schema for raw rooms input (which might use 'unidadId' instead of 'unitId')
exports.RawRoomImportSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1),
    unidadId: zod_1.z.number().int().positive().optional(),
    unitId: zod_1.z.number().int().positive().optional()
}).refine(data => data.unidadId !== undefined || data.unitId !== undefined, {
    message: "Debe especificarse unidadId o unitId"
});
exports.UnitIPSchema = zod_1.z.object({
    id: zod_1.z.number().int().optional(),
    unitId: zod_1.z.number().int(),
    direccionIP: zod_1.z.string().ip({ version: "v4" }),
    descripcion: zod_1.z.string().min(1),
    esCritica: zod_1.z.boolean().default(false),
    activa: zod_1.z.boolean().default(true),
    timeout: zod_1.z.number().int().positive().nullable().default(null),
    intervaloPing: zod_1.z.number().int().positive().nullable().default(null),
    fechaAlta: zod_1.z.string().optional(),
    ultimaModificacion: zod_1.z.string().optional()
});
exports.SettingsSchema = zod_1.z.object({
    intervaloPing: zod_1.z.number().int().min(5).max(3600),
    fallosConsecutivos: zod_1.z.number().int().min(1).max(100),
    recuperacionesConsecutivas: zod_1.z.number().int().min(1).max(100),
    timeout: zod_1.z.number().int().min(100).max(10000),
    rutaRespaldos: zod_1.z.string().min(1),
    rutaExportaciones: zod_1.z.string().min(1),
    nombreInstitucion: zod_1.z.string().min(1),
    logo: zod_1.z.string().nullable().default(null),
    actualizacionAutomatica: zod_1.z.boolean().default(true)
});
