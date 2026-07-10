-- SME Database Schema for SQLite

PRAGMA foreign_keys = ON;

-- 1. Ciudades
CREATE TABLE IF NOT EXISTS cities (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL CHECK(nombre <> '')
);

-- 2. Unidades (Catálogo Oficial)
CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL CHECK(nombre <> ''),
    cityId TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo <> ''),
    activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0, 1)),
    motivoPausa TEXT NULL,
    fechaImportacion TEXT NOT NULL,
    ultimaActualizacion TEXT NOT NULL,
    FOREIGN KEY (cityId) REFERENCES cities(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_units_city ON units(cityId);
CREATE INDEX IF NOT EXISTS idx_units_activo ON units(activo);

-- 3. Cuartos (Catálogo Oficial)
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    unitId INTEGER NOT NULL,
    nombre TEXT NOT NULL CHECK(nombre <> ''),
    fechaImportacion TEXT NOT NULL,
    ultimaActualizacion TEXT NOT NULL,
    FOREIGN KEY (unitId) REFERENCES units(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rooms_unit ON rooms(unitId);

-- 4. Direcciones IP de Unidades (Configuración Local de Monitoreo)
CREATE TABLE IF NOT EXISTS unit_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unitId INTEGER NOT NULL,
    direccionIP TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    esCritica INTEGER NOT NULL DEFAULT 0 CHECK(esCritica IN (0, 1)),
    activa INTEGER NOT NULL DEFAULT 1 CHECK(activa IN (0, 1)),
    timeout INTEGER NULL,             -- NULL significa usar el global
    intervaloPing INTEGER NULL,        -- NULL significa usar el global
    fechaAlta TEXT NOT NULL,
    ultimaModificacion TEXT NOT NULL,
    FOREIGN KEY (unitId) REFERENCES units(id) ON DELETE CASCADE,
    UNIQUE(unitId, direccionIP)
);
CREATE INDEX IF NOT EXISTS idx_unit_ips_unit ON unit_ips(unitId);
CREATE INDEX IF NOT EXISTS idx_unit_ips_activa ON unit_ips(activa);
CREATE INDEX IF NOT EXISTS idx_unit_ips_ip ON unit_ips(direccionIP);

-- 5. Tickets Automáticos
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT UNIQUE NOT NULL,
    unitId INTEGER NOT NULL,
    fechaInicio TEXT NOT NULL,       -- ISO8601 YYYY-MM-DD
    horaInicio TEXT NOT NULL,        -- HH:MM:SS
    fechaFin TEXT NULL,
    horaFin TEXT NULL,
    duracionSegundos INTEGER DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'Abierto' CHECK(estado IN ('Abierto', 'Cerrado')),
    motivo TEXT NOT NULL,
    observaciones TEXT NULL,
    ticketProveedor TEXT NULL,
    creadoAutomaticamente INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (unitId) REFERENCES units(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_tickets_unit ON tickets(unitId);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(estado);
CREATE INDEX IF NOT EXISTS idx_tickets_fecha ON tickets(fechaInicio);

-- 6. Detalles del Ticket
CREATE TABLE IF NOT EXISTS ticket_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketId INTEGER NOT NULL,
    ipId INTEGER NOT NULL,
    descripcion TEXT NOT NULL,
    estadoInicial TEXT NOT NULL,
    estadoFinal TEXT NULL,
    FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (ipId) REFERENCES unit_ips(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_ticket_details_ticket ON ticket_details(ticketId);

-- 7. Historial de Pings
CREATE TABLE IF NOT EXISTS ping_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ipId INTEGER NOT NULL,
    fechaHora TEXT NOT NULL,         -- ISO8601 YYYY-MM-DDTHH:MM:SS.SSSZ
    resultado TEXT NOT NULL CHECK(resultado IN ('ONLINE', 'OFFLINE')),
    latencia INTEGER NULL,            -- Milisegundos, NULL si falló
    mensajeError TEXT NULL,
    FOREIGN KEY (ipId) REFERENCES unit_ips(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ping_history_ip ON ping_history(ipId);
CREATE INDEX IF NOT EXISTS idx_ping_history_fecha ON ping_history(fechaHora);

-- 8. Estado del Servicio Monitor
CREATE TABLE IF NOT EXISTS monitor_status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    ultimaEjecucion TEXT NOT NULL,
    inicioServicio TEXT NOT NULL,
    estado TEXT NOT NULL CHECK(estado IN ('OPERANDO', 'DETENIDO', 'ERROR')),
    version TEXT NOT NULL,
    memoria REAL NOT NULL,                 -- MB
    cpu REAL NOT NULL,                     -- %
    ipsMonitoreadas INTEGER NOT NULL DEFAULT 0,
    ultimaActualizacion TEXT NOT NULL
);

-- 9. Configuraciones Globales
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    intervaloPing INTEGER NOT NULL DEFAULT 30,
    fallosConsecutivos INTEGER NOT NULL DEFAULT 10,
    recuperacionesConsecutivas INTEGER NOT NULL DEFAULT 3,
    timeout INTEGER NOT NULL DEFAULT 1000,
    rutaRespaldos TEXT NOT NULL,
    rutaExportaciones TEXT NOT NULL,
    nombreInstitucion TEXT NOT NULL DEFAULT 'IMSS OOAD BC',
    logo TEXT NULL,
    actualizacionAutomatica INTEGER NOT NULL DEFAULT 1,
    sondaIp TEXT DEFAULT '11.1.2.254'
);

-- 10. Historial de Importaciones
CREATE TABLE IF NOT EXISTS imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipoArchivo TEXT NOT NULL,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    usuario TEXT NOT NULL,
    registrosImportados INTEGER NOT NULL,
    errores TEXT NULL,
    duracion INTEGER NOT NULL,
    resultado TEXT NOT NULL CHECK(resultado IN ('EXITOSO', 'FALLIDO')),
    archivoOriginal TEXT NOT NULL
);

-- 11. Historial de Respaldos
CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    ruta TEXT NOT NULL,
    tamano INTEGER NOT NULL,
    automatico INTEGER NOT NULL CHECK(automatico IN (0, 1)),
    usuario TEXT NOT NULL,
    resultado TEXT NOT NULL CHECK(resultado IN ('EXITOSO', 'FALLIDO'))
);

-- 12. Historial de Exportaciones
CREATE TABLE IF NOT EXISTS exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    usuario TEXT NOT NULL,
    ruta TEXT NOT NULL,
    resultado TEXT NOT NULL CHECK(resultado IN ('EXITOSO', 'FALLIDO'))
);

-- 13. Bitácora General (Logs)
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fechaHora TEXT NOT NULL,
    nivel TEXT NOT NULL CHECK(nivel IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    modulo TEXT NOT NULL,
    evento TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    usuario TEXT NULL,
    ipEquipo TEXT NULL,
    versionSistema TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_nivel ON logs(nivel);
CREATE INDEX IF NOT EXISTS idx_logs_fecha ON logs(fechaHora);
