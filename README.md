<p align="center">
  <img src="documentation/readme_banner.png" alt="SME Telemetry Banner" width="100%" />
</p>
<div align="center">

# 🛰️ Sistema de Monitoreo de Enlaces (SME)
[![GitHub Streak](https://streak-stats.demolab.com/?user=DenverCoder1)](https://git.io/streak-stats)

### Plataforma Profesional para el Monitoreo Inteligente de Infraestructura de Red

<img src="https://img.shields.io/badge/Version-1.0-2563EB?style=for-the-badge" />
<img src="https://img.shields.io/badge/Status-En%20Desarrollo-10B981?style=for-the-badge" />
<img src="https://img.shields.io/badge/License-MIT-success?style=for-the-badge" />
<img src="https://img.shields.io/badge/Node.js-22.x-339933?style=for-the-badge&logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />

---

### Centro de Operaciones para el monitoreo continuo de enlaces institucionales

Desarrollado por **LSC Israel Díaz Serrano**

</div>

---

# 📖 Descripción

**SME (Sistema de Monitoreo de Enlaces)** es una plataforma empresarial diseñada para supervisar de forma automática la disponibilidad de enlaces de red pertenecientes a unidades institucionales.

El sistema trabaja las **24 horas del día**, detectando fallas, generando tickets automáticos, registrando el historial de monitoreo y proporcionando indicadores en tiempo real mediante un Dashboard tipo **Network Operations Center (NOC)**.

Todo el procesamiento se realiza **localmente**, sin depender de servicios Cloud ni plataformas externas.

---

# 🎯 Objetivos

- Monitoreo automático 24/7
- Detección inteligente de caídas
- Generación automática de tickets
- Cierre automático de incidencias
- Historial completo de monitoreo
- Reportes ejecutivos
- Operación completamente local
- Arquitectura preparada para crecimiento

---

# ✨ Características

- ✅ Monitoreo continuo de infraestructura
- ✅ Dashboard en tiempo real
- ✅ Gestión automática de incidencias
- ✅ Historial completo de eventos
- ✅ Reportes PDF
- ✅ Exportación Excel
- ✅ Importación mediante JSON
- ✅ Respaldos automáticos
- ✅ Logs centralizados
- ✅ Configuración dinámica
- ✅ Aplicación PWA
- ✅ Servicio Windows independiente
- ✅ Clean Architecture
- ✅ SOLID
- ✅ Repository Pattern
- ✅ Service Pattern

---

# 🏗 Arquitectura

```
                    React + Vite
                         │
                         │
                  REST API (Express)
                         │
                ┌────────┴────────┐
                │                 │
          SQLite Database   Monitor Service
                                  │
                           ICMP / Ping Engine
                                  │
                          Equipos y Enlaces
```

Todos los módulos son completamente independientes.

---

# 🧩 Tecnologías

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- PWA

## Backend

- Node.js
- Express
- REST API

## Servicio

- Node.js Windows Service

## Base de Datos

- SQLite

---

# 📂 Estructura del Proyecto

```
SME/

frontend/
backend-api/
monitor-service/
shared/
database/
documentation/
logs/
imports/
exports/
backups/
```

---

# 📊 Funcionalidades

## Dashboard

- Estado General
- Disponibilidad
- Tickets Activos
- Estado del Monitor
- Estadísticas
- Eventos recientes

---

## Monitoreo

- Ping automático
- Confirmación de caídas
- Recuperación inteligente
- Latencia
- Detección por múltiples IP

---

## Tickets

- Creación automática
- Cierre automático
- Historial permanente
- Folios únicos
- Cronología

---

## Administración

- Configuración de unidades
- Configuración de IPs
- Configuración global
- Importación JSON

---

## Reportes

- PDF
- Excel
- CSV

---

## Respaldos

- Manuales
- Automáticos
- Restauración

---

## Logs

- INFO
- WARNING
- ERROR
- DEBUG
- CRITICAL

---

# 🚀 Instalación

```bash
git clone https://github.com/Israel8002/SME.git

cd SME

npm install
```

---

# ▶️ Ejecución

Frontend

```bash
npm run dev
```

Backend

```bash
npm run server
```

Servicio Monitor

```bash
npm run monitor
```

---

# 📈 Estado del Proyecto

| Módulo | Estado |
|---------|--------|
| Arquitectura | ✅ |
| Base de Datos | 🚧 |
| Frontend | 🚧 |
| Backend | 🚧 |
| Servicio Monitor | 🚧 |
| Dashboard | 🚧 |
| Tickets | 🚧 |
| Reportes | 🚧 |

---

# 🔒 Principios de Desarrollo

- Clean Architecture
- SOLID
- DRY
- KISS
- Código desacoplado
- Alta escalabilidad
- Alta mantenibilidad

---

# 🌐 Compatibilidad

- Windows
- Linux (futuro)
- Monitores Full HD
- 2K
- 4K
- Tablets
- PWA

---

# 📜 Licencia

Este proyecto se distribuye bajo la licencia **MIT**.

---

# 👨‍💻 Autor

## LSC Israel Díaz Serrano

Coordinación de Telecomunicaciones

Especialista en

- Infraestructura de Redes
- Telefonía IP
- Desarrollo Full Stack
- Automatización
- Sistemas de Monitoreo
- Arquitecturas Empresariales

---

<div align="center">

### ⭐ Si este proyecto te resulta útil, considera darle una estrella al repositorio.

**Sistema de Monitoreo de Enlaces (SME)**

Desarrollado para la gestión profesional de infraestructura de telecomunicaciones.

© 2026 LSC Israel Díaz Serrano

</div>
