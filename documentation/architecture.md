# Documento de Arquitectura de Software: Sistema de Monitoreo de Enlaces (SME)
**Versión del Sistema:** 1.2.0

## 1. Introducción y Objetivos
El **Sistema de Monitoreo de Enlaces (SME)** es una plataforma empresarial diseñada para el monitoreo permanente, local y automatizado de la infraestructura de red en unidades institucionales. Su principal objetivo es operar de forma ininterrumpida las 24 horas del día, detectando fallas de comunicación, abriendo y cerrando incidentes (tickets) de manera autónoma, y proporcionando interfaces de consulta, reportes y configuraciones avanzadas.

El diseño del sistema prioriza la **estabilidad, la modularidad y el rendimiento óptimo**, con una separación estricta de responsabilidades entre la interfaz de usuario, los servicios API y el motor de monitoreo en segundo plano.

---

## 2. Arquitectura de Alto Nivel
SME está diseñado bajo los principios de **Clean Architecture** y **SOLID**, garantizando que los cambios en un componente (por ejemplo, actualizar la interfaz de usuario) no tengan impacto en la persistencia o el motor de monitoreo.

```
┌────────────────────────────────────────────────────────┐
│                      FRONTEND PWA                      │
│             (React + TS + Vite + Tailwind)             │
└───────────────────────────┬────────────────────────────┘
                            │ API REST (HTTP)
                            ▼
┌────────────────────────────────────────────────────────┐
│                    BACKEND API (REST)                  │
│                (Node.js + Express + TS)                │
└───────────────────────────┬────────────────────────────┘
                            │ SQL Queries (WAL Mode)
                            ▼
┌────────────────────────────────────────────────────────┐     SQL Queries     ┌────────────────────────────────────────────────────────┐
│                   PERSISTENCIA SQLITE                  │◄────────────────────┤                  SME MONITOR SERVICE                   │
│                    (Base de Datos)                     │     (WAL Mode)      │           (Servicio de Windows - Node.js)              │
└────────────────────────────────────────────────────────┘                     └────────────────────────────────────────────────────────┘
```

### Componentes Principales:
1. **Frontend PWA**: Interfaz de usuario rica y reactiva, optimizada para visualización tipo NOC (Network Operations Center). Solo consume datos de la API REST y no ejecuta lógica de monitoreo directa.
2. **Backend API**: Servidor RESTful local que gestiona la base de datos SQLite, procesa importaciones/exportaciones, gestiona copias de seguridad (respaldos) y expone endpoints. No ejecuta pings.
3. **SME Monitor Service**: Proceso independiente en Node.js que corre como un Servicio de Windows. Ejecuta los pings concurrentes, gestiona los contadores de fallos y recuperaciones, y abre/cierra tickets directamente en la base de datos.
4. **Base de Datos SQLite**: Archivo único de persistencia local. Se habilita en modo **WAL (Write-Ahead Logging)** para permitir concurrencia robusta de lectura y escritura entre la API y el Servicio Monitor.

---

## 3. Arquitectura de Módulos (Clean Architecture)
Tanto en la API como en el Monitor, el código se estructurará siguiendo el patrón de capas desacopladas:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Capa de Infraestructura (Express, SQLite, node-windows, fs, child_process)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Capa de Controladores / Presentadores (Adaptadores que exponen endpoints/servicios)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Capa de Aplicación (Servicios, Casos de Uso: ImportarCatálogos, GenerarTicket)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Capa de Dominio (Entidades de Negocio, Repositorios e interfaces base)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Diseño del Almacenamiento (Base de Datos SQLite)
La persistencia se realiza localmente en una base de datos SQLite normalizada. Para garantizar el rendimiento con grandes volúmenes de datos, se crean índices en las llaves foráneas y campos de consulta frecuentes.

### Diagrama de Relaciones
- `cities` (1) ─── (N) `units`
- `units` (1) ─── (N) `rooms`
- `units` (1) ─── (N) `unit_ips`
- `unit_ips` (1) ─── (N) `ping_history`
- `units` (1) ─── (N) `tickets`
- `tickets` (1) ─── (N) `ticket_details`

### Definición de Tablas (DDL)

```sql
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
    actualizacionAutomatica INTEGER NOT NULL DEFAULT 1
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
```

---

## 5. Diseño Detallado de Módulos

### A. Módulo de Importación de Catálogos
Este módulo procesa los archivos JSON oficiales (`cities.json`, `units.json`, `rooms.json`).

*   **Transaccionalidad Estricta**: La importación de un archivo se realiza dentro de una transacción de base de datos (`BEGIN TRANSACTION`). Si se encuentra algún error de validación o integridad relacional, se ejecuta `ROLLBACK` y la base de datos permanece intacta.
*   **Validaciones Previas**:
    1.  Estructura e integridad de los datos usando esquemas privados/compartidos (ej. Zod). No se permiten campos adicionales ni faltantes.
    2.  No existencia de duplicados de ID en el JSON.
    3.  Validación cruzada: Todas las unidades deben hacer referencia a un `cityId` existente (en la base de datos o en el JSON entrante). Todos los cuartos deben pertenecer a una unidad existente.
    4.  No se permiten campos de texto vacíos o nulos en elementos requeridos.
*   **Políticas de Sincronización**:
    *   **Ciudades, Unidades y Cuartos Nuevos**: Se insertan con fechas de importación.
    *   **Modificaciones**: Si una unidad o ciudad ya existe pero cambia de nombre o tipo, se actualiza el registro respetando su ID. **Toda la configuración local de IPs, tickets y pings asociados se conserva intacta.**
    *   **Eliminaciones lógicas**: Si una unidad o cuarto deja de existir en el catálogo JSON oficial, se marca como `activo = 0`. **Bajo ninguna circunstancia se eliminan físicamente de la base de datos**, para asegurar la trazabilidad histórica de los tickets y métricas.

### B. Módulo de Configuración de Monitoreo (Administración de IPs)
Permite configurar el monitoreo por unidad:
*   Cada unidad puede tener múltiples IPs asociadas.
*   Cada IP se asocia a parámetros de `intervaloPing` y `timeout`. Si están en `NULL`, heredan los valores globales definidos en `settings`.
*   **IP Crítica vs No Crítica**:
    *   Las IPs críticas se monitorean para determinar el estado de la unidad y abrir tickets automáticos.
    *   Las IPs no críticas registran su historial de pings y cambian su propio estado (ONLINE/OFFLINE), pero no generan tickets ni afectan el estado global de la unidad.
*   **Modos de Monitoreo por Unidad**:
    *   **Modo A (Cualquier IP Crítica)**: Se genera un ticket cuando *cualquiera* de las IPs críticas configuradas en la unidad entra en estado de falla confirmada (llegar a `fallosConsecutivos` configurados).
    *   **Modo B (Todas las IPs Críticas)**: Se genera un ticket únicamente cuando *todas* las IPs críticas de la unidad se encuentran caídas simultáneamente.

### C. SME Monitor Service (El Servicio de Windows)
Proceso independiente en Node.js desarrollado en TypeScript. Corre como servicio del sistema operativo mediante un wrapper de servicios de Windows (`node-windows` o configurado mediante `nssm`).

*   **Concurrencia Controlada (Cola de Monitoreo)**: En lugar de pings secuenciales o paralelos infinitos que saturen la CPU, el monitor mantiene una cola activa con un límite máximo de ejecuciones de ping concurrentes (configurable globalmente: `maxPingsSimultaneos`, ej. 20 pings paralelos).
*   **Algoritmo de Ping**: Dado que el sistema opera en Windows, se ejecutará el comando nativo `ping -n 1 -w <timeout> <ip>` mediante `child_process.spawn`. Esto evita requerir privilegios de Administrador del sistema para abrir raw sockets.
*   **Confirmación de Caída e Incidencia**:
    *   Cada IP activa tiene un contador local de fallos consecutivos en memoria.
    *   Si el ping falla, el contador incrementa. Si llega a `fallosConsecutivos` (configurable localmente o globalmente), la IP cambia a `OFFLINE`.
    *   Si la IP es crítica, se evalúa la regla de la unidad (Modo A o Modo B) para determinar si se genera un ticket.
*   **Confirmación de Recuperación**:
    *   Cuando una IP caída vuelve a responder, el contador de recuperaciones consecutivas incrementa.
    *   Solo al llegar a `recuperacionesConsecutivas` consecutivas (ej. 3 respuestas exitosas) se consolida el estado como `ONLINE`.
    *   Si es necesario, se cierra el ticket de la unidad y se calcula la duración del incidente en segundos.

### D. Gestión de Tickets Automáticos
Los incidentes se administran de manera autónoma por el monitor, con soporte para la interacción de los operadores.
*   **Folio Autogenerado**: Formato `SME-YYYYMMDD-XXXXXX`. El consecutivo `XXXXXX` (ej. 000001) se reinicia automáticamente cada 1 de enero.
*   **Duración del Incidente**: Al cerrarse el ticket, se calcula la diferencia en segundos entre la fecha/hora de inicio y la fecha/hora de fin, guardando el valor numérico en `duracionSegundos` y generando una representación legible (ej. "1 día, 04 horas, 12 minutos").
*   **Trazabilidad y Campos de Gestión (Proveedor)**: Cada ticket está ligado a `ticket_details` indicando exactamente cuáles IPs críticas fallaron. Además, los operadores pueden registrar o actualizar el número de ticket externo del proveedor en el campo `ticketProveedor` para un seguimiento unificado.
*   **Cierre y Eliminación Manual**: Se permite al administrador realizar un cierre manual de tickets abiertos (registrando comentarios en `observaciones`) y llevar a cabo depuraciones (eliminación individual, selección múltiple en lote o por rangos de fechas de inicio) directamente desde el Dashboard web, manteniendo una bitácora de estas acciones en los logs.

### E. Dashboard de Operaciones (Estilo NOC)
El dashboard se concibe como una pantalla de visualización seria y ejecutiva.
*   **Ajustes de UI Obligatorios**:
    *   **Tema Únicamente Oscuro**: Fondo negro/gris muy oscuro, paneles grises con bordes finos de contraste.
    *   **Cero Distracciones**: Sin degradados, sin transparencias exageradas, sin efectos 3D, sombras marcadas o emojis.
    *   **Colores de Estado**: Verde para Operativa, Amarillo para Monitoreando, Rojo para Incidencias y Gris para Deshabilitado.
    *   **Tipografía**: Moderna, con números perfectamente legibles para visualización a distancia en pantallas de centros de monitoreo.
*   **Indicadores Clave**: Tarjetas minimalistas con estadísticas consolidadas del día: Total de Unidades, Disponibilidad Promedio, Tickets Abiertos y Estado Operativo del Monitor.
*   **Actualizaciones sin Recarga**: Conexión periódica mediante polling corto o SSE (Server-Sent Events) para actualizar los estados de las unidades de forma reactiva sin recargar la pantalla completa.

### F. Respaldos y Restauraciones
*   **Respaldos Manuales y Programados**: Los respaldos se empaquetan en archivos ZIP conteniendo una copia del archivo SQLite y opcionalmente los archivos de configuración local.
*   **Integridad y Rollback**: Antes de restaurar un respaldo:
    1.  Se valida la integridad del archivo ZIP y de la base de datos contenida.
    2.  Se realiza un respaldo temporal automático del estado actual.
    3.  Si la restauración falla, se restaura el estado temporal para evitar pérdida de información.
*   **Consistencia de Archivos**: Los respaldos tienen nombres únicos estructurados con marca de tiempo: `SME_Backup_YYYY-MM-DD_HHMMSS.zip`.

### G. Módulo de Logs
Bitácora de auditoría detallada en SQLite.
*   Cinco niveles: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`.
*   Registra de forma automática inicios/paradas del monitor, fallos de ping, aperturas de tickets, respaldos, importaciones y errores.
*   Cuenta con una interfaz de consulta con filtros avanzados y paginación rápida.
*   **Depuración de Bitácora**: Se cuenta con la capacidad de realizar una limpieza general de la tabla de logs desde la pantalla de administración para optimizar el tamaño de la base de datos, dejando registrado el evento de depuración en la propia tabla limpia para auditoría.

---

## 6. Mejoras Tecnológicas Propuestas

### 1. SQLite WAL (Write-Ahead Logging)
Al ser una aplicación local con dos procesos en paralelo (API y Monitor) interactuando con el mismo archivo SQLite, se habilitará el modo WAL. Esto permite que los lectores no bloqueen a los escritores y viceversa, mejorando drásticamente la estabilidad ante pings masivos.
*Código de Inicialización de SQLite:*
```typescript
const db = new Database('sme.db');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000'); // Reintenta hasta por 5 segundos si está ocupado
```

### 2. Cola con Concurrencia Limitada (`p-limit` o similar)
Para controlar los recursos del sistema en la ejecución del Servicio Monitor, implementamos una cola asíncrona. Si el usuario configura un máximo de 30 pings simultáneos, el monitor nunca sobrepasará ese límite, previniendo picos en el uso de CPU.

### 3. Zod para Validaciones de Importación
Para asegurar que los catálogos JSON cumplen con las interfaces exactas, se utilizarán esquemas de validación estrictos en TypeScript con Zod. Cualquier campo extra o tipo erróneo arrojará un error detallado y detendrá la transacción.

### 4. Wrapper de Ping basado en `child_process`
El comando nativo de ping en Windows es fiable y no requiere permisos especiales. Se implementará una clase `PingExecutor` que analiza la salida de la consola de Windows para extraer latencia y mensajes de error (Timeout, Destino inalcanzable, etc.).

---

## 7. Estructura de Directorios del Proyecto
El proyecto en el espacio de trabajo está estructurado de la siguiente manera:

```
SME/
├── shared/                       # Tipos, interfaces y esquemas comunes de TS (Zod)
│   └── src/
│       └── index.ts              # Declaraciones unificadas de tipos y validaciones
├── database/                     # Archivo de base de datos SQLite y scripts DDL
│   ├── init-db.ts                # Inicialización y migraciones
│   ├── schema.sql                # Definición de tablas e índices
│   ├── sme.db                    # Base de datos SQLite activa (WAL Mode)
│   ├── sme.db-shm                # Archivo SQLite Shared Memory
│   └── sme.db-wal                # Archivo SQLite Write-Ahead Log
├── backend-api/                  # API REST Express + TypeScript
│   ├── src/
│   │   ├── config/               # Conexión DB y configuración de logger
│   │   ├── controllers/          # Controladores (Backup, Export, Import, Log, Ticket, Unit)
│   │   ├── utils/                # Utilidades de ayuda
│   │   └── server.ts             # Servidor Express y definición de endpoints
│   ├── package.json
│   └── tsconfig.json
├── monitor-service/              # Servicio de Windows en Node.js + TypeScript
│   ├── src/
│   │   ├── services/             # Cola de ejecución (QueueManager) y ejecutor de Pings (PingExecutor)
│   │   └── monitor.ts            # Hilo de ejecución principal del monitor
│   ├── install-service.ps1       # Script PowerShell para instalación del servicio
│   ├── uninstall-service.ps1     # Script PowerShell para desinstalación del servicio
│   ├── package.json
│   └── tsconfig.json
├── frontend/                     # Interfaz SPA React + TS + Vite + TailwindCSS
│   ├── src/
│   │   ├── assets/               # Archivos estáticos
│   │   ├── App.css               # Estilos globales específicos
│   │   ├── App.tsx               # Componente React principal (Dashboard NOC y módulos unificados)
│   │   ├── index.css             # Estilos de Tailwind CSS y base
│   │   └── main.tsx              # Punto de entrada de la aplicación React
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── backups/                      # Carpeta local para almacenamiento de respaldos ZIP
├── exports/                      # Carpeta local para reportes PDF/Excel generados
├── imports/                      # Carpeta para depósitos de archivos JSON a importar
├── logs/                         # Registros de log adicionales en texto plano si se requieren
└── documentation/                # Documentos de especificación técnica y manuales
    └── architecture.md           # Documentación de arquitectura
```
