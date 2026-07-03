import { z } from "zod";
export type CityId = "MXL" | "TIJ" | "ENS" | "SLRC" | "TKT";
export declare const CityIdSchema: z.ZodEnum<["MXL", "TIJ", "ENS", "SLRC", "TKT"]>;
export declare const UnitTypeSchema: z.ZodEnum<["Hospital Regional", "Hospital General", "Hospital General de Zona", "Hospital General Subzona", "Hospital General Regional", "Hospital Gineco Pediatría", "Hospital COVID", "UMF", "Subdelegación", "Oficinas", "Centro de Seguridad Social", "Centro de Capacitación", "Guardería", "Almacén", "Bodega", "Periférico", "Tienda", "Teatro", "Escuela", "UDDCM", "Centro CAPA", "Hospital", "Unidad", "Parque", "Centro de Mezclas", "Otro"]>;
export type UnitType = z.infer<typeof UnitTypeSchema>;
export interface City {
    id: CityId;
    nombre: string;
}
export declare const CitySchema: z.ZodObject<{
    id: z.ZodEnum<["MXL", "TIJ", "ENS", "SLRC", "TKT"]>;
    nombre: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: "MXL" | "TIJ" | "ENS" | "SLRC" | "TKT";
    nombre: string;
}, {
    id: "MXL" | "TIJ" | "ENS" | "SLRC" | "TKT";
    nombre: string;
}>;
export interface Unit {
    id: number;
    nombre: string;
    cityId: CityId;
    tipo: UnitType;
    activo: boolean;
    motivoPausa?: string | null;
}
export declare const UnitSchema: z.ZodObject<{
    id: z.ZodNumber;
    nombre: z.ZodString;
    cityId: z.ZodEnum<["MXL", "TIJ", "ENS", "SLRC", "TKT"]>;
    tipo: z.ZodUnion<[z.ZodEnum<["Hospital Regional", "Hospital General", "Hospital General de Zona", "Hospital General Subzona", "Hospital General Regional", "Hospital Gineco Pediatría", "Hospital COVID", "UMF", "Subdelegación", "Oficinas", "Centro de Seguridad Social", "Centro de Capacitación", "Guardería", "Almacén", "Bodega", "Periférico", "Tienda", "Teatro", "Escuela", "UDDCM", "Centro CAPA", "Hospital", "Unidad", "Parque", "Centro de Mezclas", "Otro"]>, z.ZodString]>;
    activo: z.ZodBoolean;
    motivoPausa: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: number;
    nombre: string;
    cityId: "MXL" | "TIJ" | "ENS" | "SLRC" | "TKT";
    tipo: string;
    activo: boolean;
    motivoPausa?: string | null | undefined;
}, {
    id: number;
    nombre: string;
    cityId: "MXL" | "TIJ" | "ENS" | "SLRC" | "TKT";
    tipo: string;
    activo: boolean;
    motivoPausa?: string | null | undefined;
}>;
export interface Room {
    id?: string;
    unitId: number;
    nombre: string;
}
export declare const RoomSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    unitId: z.ZodNumber;
    nombre: z.ZodString;
}, "strip", z.ZodTypeAny, {
    nombre: string;
    unitId: number;
    id?: string | undefined;
}, {
    nombre: string;
    unitId: number;
    id?: string | undefined;
}>;
export declare const RawRoomImportSchema: z.ZodEffects<z.ZodObject<{
    nombre: z.ZodString;
    unidadId: z.ZodOptional<z.ZodNumber>;
    unitId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    nombre: string;
    unitId?: number | undefined;
    unidadId?: number | undefined;
}, {
    nombre: string;
    unitId?: number | undefined;
    unidadId?: number | undefined;
}>, {
    nombre: string;
    unitId?: number | undefined;
    unidadId?: number | undefined;
}, {
    nombre: string;
    unitId?: number | undefined;
    unidadId?: number | undefined;
}>;
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
export declare const UnitIPSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    unitId: z.ZodNumber;
    direccionIP: z.ZodString;
    descripcion: z.ZodString;
    esCritica: z.ZodDefault<z.ZodBoolean>;
    activa: z.ZodDefault<z.ZodBoolean>;
    timeout: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    intervaloPing: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    fechaAlta: z.ZodOptional<z.ZodString>;
    ultimaModificacion: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    unitId: number;
    direccionIP: string;
    descripcion: string;
    esCritica: boolean;
    activa: boolean;
    timeout: number | null;
    intervaloPing: number | null;
    id?: number | undefined;
    fechaAlta?: string | undefined;
    ultimaModificacion?: string | undefined;
}, {
    unitId: number;
    direccionIP: string;
    descripcion: string;
    id?: number | undefined;
    esCritica?: boolean | undefined;
    activa?: boolean | undefined;
    timeout?: number | null | undefined;
    intervaloPing?: number | null | undefined;
    fechaAlta?: string | undefined;
    ultimaModificacion?: string | undefined;
}>;
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
export declare const SettingsSchema: z.ZodObject<{
    intervaloPing: z.ZodNumber;
    fallosConsecutivos: z.ZodNumber;
    recuperacionesConsecutivas: z.ZodNumber;
    timeout: z.ZodNumber;
    rutaRespaldos: z.ZodString;
    rutaExportaciones: z.ZodString;
    nombreInstitucion: z.ZodString;
    logo: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    actualizacionAutomatica: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    timeout: number;
    intervaloPing: number;
    fallosConsecutivos: number;
    recuperacionesConsecutivas: number;
    rutaRespaldos: string;
    rutaExportaciones: string;
    nombreInstitucion: string;
    logo: string | null;
    actualizacionAutomatica: boolean;
}, {
    timeout: number;
    intervaloPing: number;
    fallosConsecutivos: number;
    recuperacionesConsecutivas: number;
    rutaRespaldos: string;
    rutaExportaciones: string;
    nombreInstitucion: string;
    logo?: string | null | undefined;
    actualizacionAutomatica?: boolean | undefined;
}>;
