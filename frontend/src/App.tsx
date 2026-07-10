import React, { useState, useEffect } from "react";
import {
  Activity,
  Layers,
  FileText,
  Download,
  Upload,
  Database as DbIcon,
  Settings as SettingsIcon,
  Terminal,
  Info,
  Server,
  RefreshCw,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  FileSpreadsheet,
  Clock,
  Menu,
  ChevronLeft,
  ChevronRight,
  User,
  ArrowUpDown
} from "lucide-react";

// Local API URL
const API_URL = window.location.origin;

// Helper for IPv4 validation
const isValidIPv4 = (ip: string) => {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every(part => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString();
  });
};

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [initialSelectedTicketId, setInitialSelectedTicketId] = useState<number | null>(null);

  // State for monitor and summary figures
  const [status, setStatus] = useState<any>({
    monitor: { estado: "Cargando...", version: "1.0.0", ipsMonitoreadas: 0, cpu: 0, memoria: 0 },
    summary: { totalUnidades: 0, unidadesActivas: 0, unidadesOperativas: 0, unidadesConIncidencia: 0, ticketsAbiertos: 0, ticketsCerradosHoy: 0, disponibilidadGeneral: 100.00 }
  });

  // Global triggers and config
  const [globalSettings, setGlobalSettings] = useState<any>({
    intervaloPing: 30,
    fallosConsecutivos: 10,
    recuperacionesConsecutivas: 3,
    timeout: 1000,
    rutaRespaldos: "",
    rutaExportaciones: "",
    nombreInstitucion: "IMSS OOAD BC",
    actualizacionAutomatica: true,
    sondaIp: "11.1.2.254"
  });

  const [activity, setActivity] = useState<any[]>([]);
  const consoleRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [activity]);

  useEffect(() => {
    // Set browser tab title
    document.title = "SME Monitor";

    // Clock interval
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Initial fetches
    fetchStatus();
    fetchSettings();
    fetchActivity();

    // Auto-refresh summary data every 10 seconds
    const statusTimer = setInterval(fetchStatus, 10000);
    // Auto-refresh activity logs every 4 seconds for real-time console
    const activityTimer = setInterval(fetchActivity, 4000);

    return () => {
      clearInterval(clockTimer);
      clearInterval(statusTimer);
      clearInterval(activityTimer);
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Error fetching summary status:", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        setGlobalSettings(data);
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await fetch(`${API_URL}/api/monitor/activity`);
      if (res.ok) {
        const data = await res.json();
        setActivity(data || []);
      }
    } catch (err) {
      console.error("Error fetching activity:", err);
    }
  };

  // --- RENDERING TABS ---
  return (
    <div className="flex h-screen bg-[#050505] text-[#f3f4f6] font-sans overflow-hidden">
      {/* SIDEBAR */}
      <div
        className={`${sidebarOpen ? "w-64" : "w-16"
          } transition-all duration-300 bg-[#121212] border-r border-[#262626] flex flex-col z-20 h-full`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#262626]">
          {sidebarOpen ? (
            <div className="flex items-center space-x-2">
              <Activity className="h-6 w-6 text-[#1e88e5] animate-pulse" />
              <span className="font-bold text-sm tracking-wider">SME MONITOR</span>
            </div>
          ) : (
            <Activity className="h-6 w-6 text-[#1e88e5] mx-auto" />
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-[#262626] text-gray-400 hover:text-white"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 space-y-1">
          {[
            { id: "dashboard", label: "Dashboard", icon: Server },
            { id: "unidades", label: "Unidades", icon: Layers },
            { id: "tickets", label: "Tickets", icon: FileText },
            { id: "reportes", label: "Reportes", icon: Download },
            { id: "importaciones", label: "Importaciones", icon: Upload },
            { id: "respaldos", label: "Respaldos", icon: DbIcon },
            { id: "configuracion", label: "Configuración", icon: SettingsIcon },
            { id: "logs", label: "Logs del Sistema", icon: Terminal },
            { id: "acerca", label: "Acerca del Sistema", icon: Info }
          ].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-4 py-3 text-sm transition-colors duration-150 ${active
                  ? "bg-[#1e88e5]/10 text-white border-l-4 border-[#1e88e5] font-semibold"
                  : "text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200 border-l-4 border-transparent"
                  }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-[#1e88e5]" : "text-gray-400"} ${sidebarOpen ? "mr-3" : "mx-auto"}`} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        {sidebarOpen && (
          <div className="p-4 border-t border-[#262626] bg-[#0d0d0d] text-[11px] text-gray-500 text-center">
            V1.2.0 | LSC Israel Díaz
          </div>
        )}
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {/* HEADER */}
        <header className="h-16 bg-[#121212] border-b border-[#262626] flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center space-x-4">
            <span className="font-semibold text-lg">{globalSettings.nombreInstitucion}</span>
            <div className="h-4 w-px bg-[#262626]"></div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-gray-500 uppercase tracking-widest">Servicio:</span>
              <span
                className={`h-2.5 w-2.5 rounded-full inline-block ${status.monitor?.estado === "OPERANDO" ? "bg-green-500 animate-pulse" : "bg-red-500"
                  }`}
              ></span>
              <span className="text-xs font-semibold text-gray-300">
                {status.monitor?.estado || "DESCONOCIDO"}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-sm text-gray-400">
            <div>
              <span className="text-[11px] text-gray-500 mr-2">CPU:</span>
              <span className="font-mono text-gray-300 font-semibold">{status.monitor?.cpu || 0}%</span>
            </div>
            <div>
              <span className="text-[11px] text-gray-500 mr-2">MEMORIA:</span>
              <span className="font-mono text-gray-300 font-semibold">{status.monitor?.memoria || 0} MB</span>
            </div>
            <div className="font-mono text-gray-300 font-semibold">
              {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()}
            </div>
          </div>
        </header>

        {/* WORK AREA */}
        <main className="flex-grow overflow-y-auto p-6">
          {activeTab === "dashboard" && (
            <DashboardPage
              status={status}
              fetchStatus={fetchStatus}
              setActiveTab={setActiveTab}
              openTicketOnTicketsTab={(id) => {
                setInitialSelectedTicketId(id);
                setActiveTab("tickets");
              }}
              activity={activity}
              consoleRef={consoleRef}
            />
          )}
          {activeTab === "unidades" && <UnitsPage />}
          {activeTab === "tickets" && (
            <TicketsPage
              initialSelectedTicketId={initialSelectedTicketId}
              setInitialSelectedTicketId={setInitialSelectedTicketId}
            />
          )}
          {activeTab === "reportes" && <ReportsPage globalSettings={globalSettings} />}
          {activeTab === "importaciones" && <ImportsPage />}
          {activeTab === "respaldos" && <BackupsPage />}
          {activeTab === "configuracion" && <SettingsPage settings={globalSettings} fetchSettings={fetchSettings} />}
          {activeTab === "logs" && <LogsPage />}
          {activeTab === "acerca" && <AboutPage status={status} />}
        </main>
      </div>
    </div>
  );
}

// ==========================================
// 1. DASHBOARD PAGE
// ==========================================
function DashboardPage({
  status,
  fetchStatus,
  setActiveTab,
  openTicketOnTicketsTab,
  activity,
  consoleRef
}: {
  status: any;
  fetchStatus: () => void;
  setActiveTab: (t: string) => void;
  openTicketOnTicketsTab: (id: number) => void;
  activity: any[];
  consoleRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [units, setUnits] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load first page of active units
      const res = await fetch(`${API_URL}/api/units?limit=10`);
      if (res.ok) {
        const uData = await res.json();
        setUnits(uData.data || []);
      }
      // Load open tickets
      const tRes = await fetch(`${API_URL}/api/tickets?estado=Abierto&limit=5`);
      if (tRes.ok) {
        const tData = await tRes.json();
        setTickets(tData.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stats = status.summary;

  return (
    <div className="space-y-6">
      {/* STATS PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Unidades", val: stats.totalUnidades, border: "border-gray-800" },
          { label: "Unidades Activas", val: stats.unidadesActivas, border: "border-gray-800" },
          { label: "Unidades en Línea", val: stats.unidadesOperativas, border: "border-green-800", color: "text-green-500" },
          { label: "Unidades con Falla", val: stats.unidadesConIncidencia, border: "border-red-800", color: "text-red-500" },
          { label: "Tickets Abiertos", val: stats.ticketsAbiertos, border: "border-red-800", color: "text-red-500" },
          { label: "Cerrados Hoy", val: stats.ticketsCerradosHoy, border: "border-blue-800", color: "text-[#1e88e5]" }
        ].map((c, i) => (
          <div key={i} className={`bg-[#121212] p-4 border ${c.border} rounded`}>
            <div className="text-gray-500 text-[11px] uppercase tracking-wider">{c.label}</div>
            <div className={`text-2xl font-bold mt-1 font-mono ${c.color || "text-white"}`}>{c.val}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: ACTIVE TICKETS */}
        <div className="bg-[#121212] border border-[#262626] rounded flex flex-col h-[520px]">
          <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between">
            <span className="font-bold text-sm tracking-wide">TICKETS ACTIVOS</span>
            <button onClick={() => setActiveTab("tickets")} className="text-xs text-[#1e88e5] hover:underline">Ver todos</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tickets.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-600">
                Sin incidencias registradas en este momento
              </div>
            ) : (
              tickets.map((t, idx) => (
                <div
                  key={idx}
                  onClick={() => openTicketOnTicketsTab(t.id)}
                  className="bg-[#181818] hover:bg-[#222] border-l-4 border-red-500 p-3 rounded text-xs space-y-1 cursor-pointer transition-all duration-100"
                  title="Haga clic para ver detalles del ticket"
                >
                  <div className="flex justify-between font-bold">
                    <span className="text-red-400">{t.folio}</span>
                    <span className="text-gray-500 font-mono">{t.fechaInicio}</span>
                  </div>
                  <div className="text-gray-300 font-semibold">{t.unidadNombre}</div>
                  <div className="text-gray-400 italic text-[11px] truncate">{t.motivo}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: MONITOR DE OPERACIONES */}
        <div className="bg-[#121212] border border-[#262626] rounded flex flex-col h-[520px] lg:col-span-2">
          <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between">
            <span className="font-bold text-sm tracking-wide">MONITOR DE OPERACIONES</span>
            <button onClick={loadDashboardData} className="p-1 rounded hover:bg-[#262626] text-gray-400">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-3 overflow-hidden">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#181818] p-3 rounded text-center">
                <div className="text-gray-500 text-[10px] uppercase tracking-wider">Enlaces Monitoreados</div>
                <div className="text-2xl font-bold font-mono text-[#1e88e5] mt-0.5">{status.monitor?.ipsMonitoreadas || 0}</div>
              </div>
              <div className="bg-[#181818] p-3 rounded text-center">
                <div className="text-gray-500 text-[10px] uppercase tracking-wider">Última Evaluación</div>
                <div className="text-sm font-semibold text-gray-300 mt-2 font-mono">
                  {status.monitor?.ultimaEjecucion ? new Date(status.monitor.ultimaEjecucion).toLocaleTimeString() : "No registrado"}
                </div>
              </div>
            </div>

            <div className="border border-[#262626] p-3 rounded bg-[#0d0d0d] space-y-1.5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Métricas de Confiabilidad</div>
              <div className="flex justify-between items-center text-xs">
                <span>Disponibilidad Promedio (30d):</span>
                <span className="font-bold text-green-500 font-mono">99.85%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span>Tiempo de Respuesta Promedio:</span>
                <span className="font-bold text-blue-400 font-mono">8 ms</span>
              </div>
            </div>

            {/* PowerShell-style Console */}
            <div className="flex-1 bg-[#012456] border border-[#204075] rounded p-3 font-mono text-[10px] overflow-hidden flex flex-col justify-start text-left min-h-[200px]">
              <div className="text-yellow-400 font-bold">Windows PowerShell</div>
              <div className="text-gray-400">Copyright (C) Microsoft Corporation. Todos los derechos reservados.</div>
              <div className="text-cyan-400 mb-1">SME Monitor Service: Activo y en ejecución...</div>
              
              <div ref={consoleRef} className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-[#1565c0]">
                {activity.length === 0 ? (
                  <div className="text-gray-500 italic">Cargando registros de actividad...</div>
                ) : (
                  activity.map((act, index) => (
                    <div key={index} className={act.color || "text-white"}>
                      {act.text}
                    </div>
                  ))
                )}
                <div className="text-white mt-1 flex items-center">
                  <span>PS C:\SME\monitor&gt; </span>
                  <span className="animate-pulse ml-1 font-bold">_</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED UNITS TABLE */}
      <div className="bg-[#121212] border border-[#262626] rounded">
        <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between">
          <span className="font-bold text-sm tracking-wide">ESTADO GENERAL DE UNIDADES DE TELECOMUNICACIONES</span>
          <button onClick={() => setActiveTab("unidades")} className="text-xs text-[#1e88e5] hover:underline">Configurar Enlaces</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0f0f0f] border-b border-[#262626] text-gray-400 uppercase font-mono tracking-wider">
              <tr>
                <th className="p-3">Estado</th>
                <th className="p-3">Unidad ID</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">Ciudad</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">IPs Config.</th>
                <th className="p-3">Última Caída</th>
                <th className="p-3">Disponibilidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">Cargando información...</td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">No se encontraron registros en el catálogo</td>
                </tr>
              ) : (
                units.map((u, idx) => (
                  <tr key={idx} className="hover:bg-[#181818] transition-colors duration-100">
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.estado === "Operativa" ? "bg-green-500/10 text-green-500" :
                        u.estado === "Con Incidencia" ? "bg-red-500/10 text-red-500" :
                          u.estado === "Monitoreando" ? "bg-yellow-500/10 text-yellow-500" : "bg-gray-500/10 text-gray-500"
                        }`}>
                        {u.estado}
                      </span>
                    </td>
                    <td className="p-3 font-mono">{u.id}</td>
                    <td className="p-3 font-semibold">{u.nombre}</td>
                    <td className="p-3">{u.ciudadNombre}</td>
                    <td className="p-3">{u.tipo}</td>
                    <td className="p-3 font-mono">{u.ipsConfiguradas} ({u.ipsCriticas} críticas)</td>
                    <td className="p-3 font-mono text-gray-400">{u.ultimaCaida ? u.ultimaCaida.substring(0, 16) : "Sin caídas"}</td>
                    <td className="p-3 font-mono font-bold text-green-400">{u.disponibilidad}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. UNIDADES & IP CONFIG PAGE
// ==========================================
function UnitsPage() {
  const [units, setUnits] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [cityId, setCityId] = useState("");
  const [tipo, setTipo] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Detail Modal States
  const [selectedUnit, setSelectedUnit] = useState<any | null>(null);
  const [unitDetail, setUnitDetail] = useState<any | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState("general");

  // Checking states for manual monitoring
  const [checkingIpId, setCheckingIpId] = useState<number | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);

  // IP Add/Edit Form States
  const [ipFormOpen, setIpFormOpen] = useState(false);
  const [editingIp, setEditingIp] = useState<any | null>(null);
  const [ipAddress, setIpAddress] = useState("");
  const [ipDesc, setIpDesc] = useState("");
  const [ipCritical, setIpCritical] = useState(false);
  const [ipActive, setIpActive] = useState(true);
  const [ipTimeout, setIpTimeout] = useState("");
  const [ipInterval, setIpInterval] = useState("");
  const [validationError, setValidationError] = useState("");

  // Add Unit Form States
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitId, setNewUnitId] = useState("");
  const [newUnitNombre, setNewUnitNombre] = useState("");
  const [newUnitCityId, setNewUnitCityId] = useState("");
  const [newUnitTipo, setNewUnitTipo] = useState("");

  // Edit Unit Name & Add Room States
  const [isEditingUnitName, setIsEditingUnitName] = useState(false);
  const [editedUnitName, setEditedUnitName] = useState("");
  const [newRoomName, setNewRoomName] = useState("");

  useEffect(() => {
    loadUnits();
  }, [search, cityId, tipo, state, page]);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const url = `${API_URL}/api/units?search=${encodeURIComponent(search)}&cityId=${cityId}&tipo=${encodeURIComponent(tipo)}&state=${state}&page=1&limit=500`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setUnits(data.data || []);
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (unit: any) => {
    setSelectedUnit(unit);
    setEditedUnitName(unit.nombre);
    setIsEditingUnitName(false);
    setActiveDetailTab("general");
    try {
      const res = await fetch(`${API_URL}/api/units/${unit.id}`);
      if (res.ok) {
        const data = await res.json();
        setUnitDetail(data);
      }
    } catch (err) {
      console.error("Error fetching unit details:", err);
    }
  };

  const closeDetail = () => {
    setSelectedUnit(null);
    setUnitDetail(null);
    loadUnits(); // Reload counts
  };

  // IP CRUD Actions
  const handleSaveIp = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!isValidIPv4(ipAddress)) {
      setValidationError("La dirección IP no tiene un formato IPv4 válido.");
      return;
    }
    if (!ipDesc.trim()) {
      setValidationError("La descripción es obligatoria.");
      return;
    }

    const payload = {
      direccionIP: ipAddress,
      descripcion: ipDesc,
      esCritica: ipCritical,
      activa: ipActive,
      timeout: ipTimeout ? parseInt(ipTimeout) : null,
      intervaloPing: ipInterval ? parseInt(ipInterval) : null
    };

    try {
      const url = editingIp
        ? `${API_URL}/api/units/${selectedUnit.id}/ips/${editingIp.id}`
        : `${API_URL}/api/units/${selectedUnit.id}/ips`;
      const method = editingIp ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIpFormOpen(false);
        // Reload details
        openDetail(selectedUnit);
      } else {
        const errData = await res.json();
        setValidationError(errData.error || "Falla al guardar configuración");
      }
    } catch (err: any) {
      setValidationError(err.message);
    }
  };

  const startEditIp = (ip: any) => {
    setEditingIp(ip);
    setIpAddress(ip.direccionIP);
    setIpDesc(ip.descripcion);
    setIpCritical(ip.esCritica === 1);
    setIpActive(ip.activa === 1);
    setIpTimeout(ip.timeout || "");
    setIpInterval(ip.intervaloPing || "");
    setValidationError("");
    setIpFormOpen(true);
  };

  const startAddIp = () => {
    setEditingIp(null);
    setIpAddress("");
    setIpDesc("");
    setIpCritical(true);
    setIpActive(true);
    setIpTimeout("");
    setIpInterval("");
    setValidationError("");
    setIpFormOpen(true);
  };

  const handleDeleteIp = async (ipId: number) => {
    if (!confirm("¿Está seguro de eliminar esta dirección IP de monitoreo?")) return;
    try {
      const res = await fetch(`${API_URL}/api/units/${selectedUnit.id}/ips/${ipId}`, { method: "DELETE" });
      if (res.ok) {
        openDetail(selectedUnit);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckIp = async (ipId: number) => {
    if (!selectedUnit) return;
    setCheckingIpId(ipId);
    try {
      const res = await fetch(`${API_URL}/api/units/${selectedUnit.id}/ips/${ipId}/check`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Monitoreo de IP finalizado.\nResultado: ${data.status}\nLatencia: ${data.latency !== null ? data.latency + 'ms' : 'N/A'}${data.errorMsg ? '\nError: ' + data.errorMsg : ''}`);
        await openDetail(selectedUnit);
      } else {
        alert(`Error al monitorear IP: ${data.error || 'Falla de comunicación'}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error de red: ${err.message}`);
    } finally {
      setCheckingIpId(null);
    }
  };

  const handleCheckAllIps = async () => {
    if (!selectedUnit) return;
    setCheckingAll(true);
    try {
      const res = await fetch(`${API_URL}/api/units/${selectedUnit.id}/check-ips`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const offlineCount = data.results.filter((r: any) => r.status === "OFFLINE").length;
        const onlineCount = data.results.filter((r: any) => r.status === "ONLINE").length;
        alert(`Revisión completa de enlaces finalizada.\n\nEnlaces ONLINE: ${onlineCount}\nEnlaces OFFLINE: ${offlineCount}`);
        await openDetail(selectedUnit);
      } else {
        alert(`Error al monitorear enlaces: ${data.error || 'Falla de comunicación'}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error de red: ${err.message}`);
    } finally {
      setCheckingAll(false);
    }
  };

  const handleToggleMonitoring = async () => {
    if (!unitDetail) return;
    const nextActivo = !unitDetail.activo;

    let motivoPausa = null;
    if (!nextActivo) {
      const reason = prompt("Ingrese el motivo de la pausa de monitoreo para esta unidad:");
      if (reason === null) return; // User cancelled
      const trimmed = reason.trim();
      if (!trimmed) {
        alert("Debe especificar un motivo para pausar el monitoreo.");
        return;
      }
      motivoPausa = trimmed;
    } else {
      const confirmMsg = "¿Desea reanudar el monitoreo para esta unidad?";
      if (!confirm(confirmMsg)) return;
    }

    try {
      const res = await fetch(`${API_URL}/api/units/${selectedUnit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: nextActivo, motivoPausa })
      });
      if (res.ok) {
        openDetail(selectedUnit);
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error al cambiar el estado del monitoreo.");
    }
  };

  const handleDeleteUnit = async () => {
    if (!unitDetail) return;
    if (!confirm(`¿Está seguro de eliminar permanentemente la unidad "${unitDetail.nombre}"? Esta acción no se puede deshacer y borrará todo su historial.`)) return;

    try {
      const res = await fetch(`${API_URL}/api/units/${selectedUnit.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        alert("Unidad eliminada exitosamente.");
        closeDetail();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error al eliminar la unidad.");
    }
  };

  const startAddUnit = () => {
    setIsAddingUnit(true);
    setNewUnitId("");
    setNewUnitNombre("");
    setNewUnitCityId("");
    setNewUnitTipo("");
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitId || !newUnitNombre || !newUnitCityId || !newUnitTipo) {
      alert("Por favor complete todos los campos.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newUnitId,
          nombre: newUnitNombre,
          cityId: newUnitCityId,
          tipo: newUnitTipo
        })
      });

      if (res.ok) {
        alert("Unidad registrada exitosamente.");
        setIsAddingUnit(false);
        setNewUnitId("");
        setNewUnitNombre("");
        setNewUnitCityId("");
        setNewUnitTipo("");
        loadUnits();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error al registrar la unidad.");
    }
  };

  const handleSaveUnitName = async () => {
    if (!editedUnitName.trim()) {
      alert("El nombre de la unidad no puede estar vacío.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/units/${selectedUnit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: editedUnitName.trim() })
      });

      if (res.ok) {
        alert("Nombre de la unidad actualizado con éxito.");
        setIsEditingUnitName(false);
        setSelectedUnit(prev => prev ? { ...prev, nombre: editedUnitName.trim() } : null);
        setUnitDetail(prev => prev ? { ...prev, nombre: editedUnitName.trim() } : null);
        loadUnits();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error al guardar el nombre de la unidad.");
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/units/${selectedUnit.id}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newRoomName.trim() })
      });

      if (res.ok) {
        setNewRoomName("");
        const detailRes = await fetch(`${API_URL}/api/units/${selectedUnit.id}`);
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          setUnitDetail(detailData);
        }
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error al agregar el cuarto.");
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm(`¿Está seguro de eliminar permanentemente este cuarto de telecomunicaciones?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/units/${selectedUnit.id}/rooms/${roomId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        const detailRes = await fetch(`${API_URL}/api/units/${selectedUnit.id}`);
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          setUnitDetail(detailData);
        }
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error al eliminar el cuarto.");
    }
  };

  return (
    <div className="space-y-6">
      {/* FILTER HEADER */}
      <div className="bg-[#121212] p-4 border border-[#262626] rounded flex flex-col xl:flex-row xl:items-center gap-4 justify-between">
        <div className="flex flex-col md:flex-row gap-4 flex-grow w-full xl:w-auto">
          <div className="relative flex-grow md:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por ID, nombre, ciudad..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-[#1c1c1c] border border-[#262626] rounded pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#1e88e5]"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 flex-grow">
            <select
              value={cityId}
              onChange={(e) => { setCityId(e.target.value); setPage(1); }}
              className="bg-[#1c1c1c] border border-[#262626] rounded p-2 text-xs text-white focus:outline-none"
            >
              <option value="">Todas las ciudades</option>
              <option value="MXL">Mexicali</option>
              <option value="TIJ">Tijuana</option>
              <option value="ENS">Ensenada</option>
              <option value="SLRC">San Luis RC</option>
              <option value="TKT">Tecate</option>
            </select>
            <select
              value={tipo}
              onChange={(e) => { setTipo(e.target.value); setPage(1); }}
              className="bg-[#1c1c1c] border border-[#262626] rounded p-2 text-xs text-white focus:outline-none"
            >
              <option value="">Todos los tipos</option>
              <option value="Hospital">Hospital</option>
              <option value="UMF">UMF</option>
              <option value="Subdelegación">Subdelegación</option>
              <option value="Oficinas">Oficinas</option>
              <option value="Guardería">Guardería</option>
            </select>
            <select
              value={state}
              onChange={(e) => { setState(e.target.value); setPage(1); }}
              className="bg-[#1c1c1c] border border-[#262626] rounded p-2 text-xs text-white focus:outline-none"
            >
              <option value="">Todos los estados</option>
              <option value="Operativa">Operativa</option>
              <option value="Con Incidencia">Con Incidencia</option>
              <option value="Monitoreando">Monitoreando</option>
              <option value="Deshabilitada">Deshabilitada</option>
            </select>
          </div>
        </div>
        <button
          onClick={startAddUnit}
          className="w-full xl:w-auto shrink-0 bg-[#1e88e5] text-white px-4 py-2 rounded font-bold hover:bg-[#1565c0] transition-colors flex items-center justify-center text-xs"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Agregar Unidad
        </button>
      </div>

      {/* CARDS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-500 text-sm">Cargando catálogo de unidades...</div>
        ) : units.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 text-sm">No se encontraron unidades con los filtros especificados.</div>
        ) : (
          units.map((u, idx) => (
            <div
              key={idx}
              onClick={() => openDetail(u)}
              className="bg-[#121212] border border-[#262626] hover:border-[#1e88e5] p-4 rounded transition-all duration-150 cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-1">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-[10px] text-gray-500">ID: {u.id}</span>
                  <span className={`inline-block h-2 w-2 rounded-full ${u.estado === "Operativa" ? "bg-green-500" :
                    u.estado === "Con Incidencia" ? "bg-red-500" :
                      u.estado === "Monitoreando" ? "bg-yellow-500" : "bg-gray-500"
                    }`}></span>
                </div>
                <div className="font-bold text-sm text-gray-100 line-clamp-1">{u.nombre}</div>
                <div className="text-gray-400 text-[11px]">{u.ciudadNombre} - {u.tipo}</div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#1c1c1c] flex items-center justify-between text-xs text-gray-500">
                <span>IPs: <b className="text-gray-300 font-mono">{u.ipsConfiguradas}</b></span>
                <span className="font-bold text-green-400 font-mono">{u.disponibilidad}% Ava.</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DETAIL MODAL OVERLAY */}
      {selectedUnit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#121212] border border-[#262626] rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#262626] flex items-center justify-between bg-[#0d0d0d]">
              <div>
                <span className="text-[10px] text-gray-500 font-mono">CONFIGURACIÓN DE ENLACES</span>
                {isEditingUnitName ? (
                  <div className="flex items-center space-x-2 mt-0.5">
                    <input
                      type="text"
                      value={editedUnitName}
                      onChange={(e) => setEditedUnitName(e.target.value)}
                      className="bg-[#1c1c1c] border border-[#262626] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#1e88e5]"
                    />
                    <button
                      onClick={handleSaveUnitName}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold px-2 py-1 rounded text-[10px] transition-colors"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setIsEditingUnitName(false)}
                      className="bg-[#262626] hover:bg-[#333] text-gray-300 px-2 py-1 rounded text-[10px] transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <h3 className="font-bold text-base text-white flex items-center gap-2 mt-0.5">
                    <span>{selectedUnit.nombre}</span>
                    <button
                      onClick={() => {
                        setEditedUnitName(selectedUnit.nombre);
                        setIsEditingUnitName(true);
                      }}
                      className="text-gray-500 hover:text-white p-1"
                      title="Editar nombre"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-gray-500 font-mono font-normal">(ID: {selectedUnit.id})</span>
                  </h3>
                )}
              </div>
              <button onClick={closeDetail} className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded hover:bg-[#262626]">
                Cerrar
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex bg-[#1a1a1a] border-b border-[#262626] text-xs">
              {[
                { id: "general", label: "Información" },
                { id: "ips", label: "Configurar IPs" },
                { id: "tickets", label: "Historial Tickets" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDetailTab(tab.id)}
                  className={`px-6 py-3 font-semibold ${activeDetailTab === tab.id
                    ? "bg-[#121212] text-white border-b-2 border-[#1e88e5]"
                    : "text-gray-400 hover:text-white"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!unitDetail ? (
                <div className="text-center text-gray-500 text-xs py-12">Cargando detalles de la unidad...</div>
              ) : (
                <>
                  {activeDetailTab === "general" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#181818] p-4 rounded space-y-3 text-xs">
                          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ficha Técnica</div>
                          <div className="flex justify-between border-b border-[#262626] pb-1.5">
                            <span className="text-gray-500">Tipo de Unidad:</span>
                            <span className="font-semibold text-gray-200">{unitDetail.tipo}</span>
                          </div>
                          <div className="flex justify-between border-b border-[#262626] pb-1.5">
                            <span className="text-gray-500">Ciudad:</span>
                            <span className="font-semibold text-gray-200">{unitDetail.ciudadNombre}</span>
                          </div>
                          <div className="flex justify-between border-b border-[#262626] pb-1.5">
                            <span className="text-gray-500">Estado de Operación:</span>
                            <span className={`font-bold ${unitDetail.estado === "Operativa" ? "text-green-500" : "text-red-500"}`}>
                              {unitDetail.estado}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Última Importación:</span>
                            <span className="font-mono text-gray-400">{unitDetail.fechaImportacion?.substring(0, 10)}</span>
                          </div>
                          {!unitDetail.activo && unitDetail.motivoPausa && (
                            <div className="border-t border-[#262626]/60 pt-2 mt-2 space-y-1">
                              <span className="text-gray-500 block text-[10px] uppercase tracking-wider font-bold">Motivo de Pausa:</span>
                              <span className="text-amber-500 font-semibold block bg-[#262626]/20 p-2 rounded border border-amber-600/10 whitespace-pre-wrap leading-relaxed">{unitDetail.motivoPausa}</span>
                            </div>
                          )}
                        </div>

                        {/* Rooms list */}
                        <div className="bg-[#181818] p-4 rounded flex flex-col h-full min-h-[220px]">
                          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                            <span>Cuartos de Telecomunicaciones (NOCs/IDFs)</span>
                          </div>
                          <div className="flex-grow overflow-y-auto max-h-[120px] text-xs space-y-1.5 pr-2 mb-3">
                            {unitDetail.rooms?.length === 0 ? (
                              <span className="text-gray-600 text-xs italic">Sin cuartos registrados en catálogo oficial</span>
                            ) : (
                              unitDetail.rooms?.map((r: any, i: number) => (
                                <div key={i} className="flex justify-between items-center border-b border-[#262626] pb-1 font-mono text-[11px] text-gray-300">
                                  <span>{r.nombre}</span>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-gray-500 text-[9px]">{r.id}</span>
                                    <button
                                      onClick={() => handleDeleteRoom(r.id)}
                                      className="text-gray-500 hover:text-red-500 p-0.5"
                                      title="Eliminar cuarto"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          <form onSubmit={handleAddRoom} className="flex gap-2 mt-auto border-t border-[#262626]/60 pt-3">
                            <input
                              type="text"
                              placeholder="Nuevo cuarto (ej. IDF-URG)"
                              value={newRoomName}
                              onChange={(e) => setNewRoomName(e.target.value)}
                              className="flex-grow bg-[#121212] border border-[#262626] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#1e88e5]"
                              required
                            />
                            <button
                              type="submit"
                              className="bg-[#1e88e5] text-white px-3 py-1 rounded font-bold hover:bg-[#1565c0] transition-colors"
                            >
                              Agregar
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* ACCIONES DE ADMINISTRACION */}
                      <div className="border-t border-[#262626] pt-4 flex flex-col sm:flex-row gap-4 justify-between items-center text-xs">
                        <div className="space-y-1 text-left w-full sm:w-auto">
                          <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Administración de Unidad</span>
                          <p className="text-gray-500 text-[11px] leading-snug">
                            {unitDetail.activo
                              ? "El monitoreo automático está activo para esta unidad. Puede pausarlo temporalmente."
                              : "El monitoreo para esta unidad está pausado. No se realizarán pings a sus enlaces."}
                          </p>
                        </div>
                        <div className="flex space-x-2 shrink-0 w-full sm:w-auto justify-end">
                          <button
                            onClick={handleCheckAllIps}
                            className="bg-blue-600/10 text-blue-500 border border-blue-600/20 hover:bg-blue-600/25 px-4 py-2 rounded font-bold transition-all duration-100 flex items-center text-[11px] disabled:opacity-40"
                            disabled={checkingAll}
                          >
                            {checkingAll ? (
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Activity className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Monitorear Enlaces
                          </button>
                          <button
                            onClick={handleToggleMonitoring}
                            className={`px-4 py-2 rounded font-bold transition-all duration-100 flex items-center text-[11px] ${unitDetail.activo
                              ? "bg-amber-600/10 text-amber-500 border border-amber-600/20 hover:bg-amber-600/25"
                              : "bg-green-600/10 text-green-500 border border-green-600/20 hover:bg-green-600/25"
                              }`}
                          >
                            {unitDetail.activo ? (
                              <>
                                <Pause className="h-3.5 w-3.5 mr-1.5" />
                                Pausar Monitoreo
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5 mr-1.5" />
                                Reanudar Monitoreo
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleDeleteUnit}
                            className="bg-red-600/10 text-red-500 border border-red-600/20 hover:bg-red-600/25 px-4 py-2 rounded font-bold transition-all duration-100 flex items-center text-[11px]"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Borrar Unidad
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeDetailTab === "ips" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Total Direcciones IP: {unitDetail.ips?.length || 0}</span>
                        <div className="flex space-x-2">
                          <button
                            onClick={handleCheckAllIps}
                            className="bg-blue-600/20 text-blue-400 border border-blue-600/30 text-xs px-3 py-1.5 rounded flex items-center hover:bg-blue-600/30 transition-all font-semibold disabled:opacity-40"
                            disabled={checkingAll}
                          >
                            {checkingAll ? (
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Activity className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Monitorear Enlaces
                          </button>
                          <button
                            onClick={startAddIp}
                            className="bg-[#1e88e5] text-white text-xs px-3 py-1.5 rounded flex items-center hover:bg-[#1565c0]"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Agregar IP
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-[#262626] rounded">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#0f0f0f] border-b border-[#262626] text-gray-400 font-mono">
                            <tr>
                              <th className="p-3">IP</th>
                              <th className="p-3">Descripción</th>
                              <th className="p-3">Tipo</th>
                              <th className="p-3">Auto Monitoreo</th>
                              <th className="p-3">Conexión</th>
                              <th className="p-3">Pings / Time</th>
                              <th className="p-3 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#262626]">
                            {unitDetail.ips?.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-6 text-center text-gray-500">Sin direcciones IP configuradas para monitoreo.</td>
                              </tr>
                            ) : (
                              unitDetail.ips?.map((ip: any) => (
                                <tr key={ip.id} className="hover:bg-[#181818]">
                                  <td className="p-3 font-mono font-bold text-gray-200">{ip.direccionIP}</td>
                                  <td className="p-3 text-gray-300">{ip.descripcion}</td>
                                  <td className="p-3">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${ip.esCritica === 1 ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-gray-500/10 text-gray-400"
                                      }`}>
                                      {ip.esCritica === 1 ? "Crítica" : "Secundaria"}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${ip.activa === 1 ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                                      }`}>
                                      {ip.activa === 1 ? "Activo" : "Pausado"}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${ip.ultimoResultado === "ONLINE" ? "bg-green-500/15 text-green-400 border border-green-500/30" :
                                      ip.ultimoResultado === "OFFLINE" ? "bg-red-500/15 text-red-400 border border-red-500/30" :
                                        "bg-gray-500/15 text-gray-400 border border-gray-500/30"
                                      }`}>
                                      <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${ip.ultimoResultado === "ONLINE" ? "bg-green-400" : ip.ultimoResultado === "OFFLINE" ? "bg-red-400" : "bg-gray-400"}`} />
                                      {ip.ultimoResultado || "SIN DATOS"}
                                      {ip.ultimoResultado === "ONLINE" && ip.ultimaLatencia !== null && ` (${ip.ultimaLatencia}ms)`}
                                    </span>
                                  </td>
                                  <td className="p-3 font-mono text-[10px] text-gray-500">
                                    {ip.intervaloPing || "Global"}s / {ip.timeout || "Global"}ms
                                  </td>
                                  <td className="p-3 text-right space-x-2">
                                    <button
                                      onClick={() => handleCheckIp(ip.id)}
                                      className="text-blue-400 hover:text-blue-300 inline-block disabled:opacity-40"
                                      title="Monitorear Enlace IP"
                                      disabled={checkingIpId === ip.id}
                                    >
                                      {checkingIpId === ip.id ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Activity className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                    <button onClick={() => startEditIp(ip)} className="text-gray-400 hover:text-white inline-block">
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteIp(ip.id)} className="text-gray-400 hover:text-red-500 inline-block">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeDetailTab === "tickets" && (
                    <div className="space-y-4">
                      <div className="overflow-x-auto border border-[#262626] rounded">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#0f0f0f] border-b border-[#262626] text-gray-400 font-mono">
                            <tr>
                              <th className="p-3">Folio</th>
                              <th className="p-3">Fecha Inicio</th>
                              <th className="p-3">Estado</th>
                              <th className="p-3">Duración</th>
                              <th className="p-3">Causa / Motivo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#262626]">
                            {unitDetail.tickets?.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-6 text-center text-gray-500">Sin tickets históricos registrados para esta unidad.</td>
                              </tr>
                            ) : (
                              unitDetail.tickets?.map((t: any) => (
                                <tr key={t.id} className="hover:bg-[#181818]">
                                  <td className="p-3 font-mono text-[#1e88e5] font-bold">{t.folio}</td>
                                  <td className="p-3 font-mono">{t.fechaInicio} {t.horaInicio}</td>
                                  <td className="p-3">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${t.estado === "Abierto" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                                      }`}>
                                      {t.estado}
                                    </span>
                                  </td>
                                  <td className="p-3 font-mono text-[10px] text-gray-400">
                                    {t.duracionLegible}
                                  </td>
                                  <td className="p-3 text-gray-300 truncate max-w-xs">{t.motivo}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* IP FORM MODAL OVERLAY */}
      {ipFormOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-55 p-4">
          <div className="bg-[#1c1c1c] border border-[#262626] rounded-lg w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#262626] bg-[#121212] flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">
                {editingIp ? "Editar IP de Monitoreo" : "Agregar Nueva IP"}
              </h4>
              <button onClick={() => setIpFormOpen(false)} className="text-gray-500 hover:text-white text-xs">
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSaveIp} className="p-6 space-y-4 text-xs">
              {validationError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded font-medium">
                  {validationError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-gray-400 font-semibold">Dirección IP (IPv4)</label>
                <input
                  type="text"
                  placeholder="172.16.10.1"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="w-full bg-[#121212] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 font-semibold">Descripción del Enlace</label>
                <input
                  type="text"
                  placeholder="Ej. Ruteador Principal, Segmento MDF"
                  value={ipDesc}
                  onChange={(e) => setIpDesc(e.target.value)}
                  className="w-full bg-[#121212] border border-[#262626] rounded p-2 text-white focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 bg-[#121212] p-2 border border-[#262626] rounded">
                  <input
                    type="checkbox"
                    checked={ipCritical}
                    onChange={(e) => setIpCritical(e.target.checked)}
                    className="h-4 w-4 accent-[#1e88e5]"
                  />
                  <label className="text-gray-300 font-medium">IP Crítica</label>
                </div>

                <div className="flex items-center space-x-2 bg-[#121212] p-2 border border-[#262626] rounded">
                  <input
                    type="checkbox"
                    checked={ipActive}
                    onChange={(e) => setIpActive(e.target.checked)}
                    className="h-4 w-4 accent-[#1e88e5]"
                  />
                  <label className="text-gray-300 font-medium">Habilitada</label>
                </div>
              </div>

              <div className="border-t border-[#262626] pt-3 grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-400">Timeout (ms) <span className="text-[10px] text-gray-500">(Opcional)</span></label>
                  <input
                    type="number"
                    placeholder="Global (1000)"
                    value={ipTimeout}
                    onChange={(e) => setIpTimeout(e.target.value)}
                    className="w-full bg-[#121212] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-400">Frecuencia (seg) <span className="text-[10px] text-gray-500">(Opcional)</span></label>
                  <input
                    type="number"
                    placeholder="Global (30)"
                    value={ipInterval}
                    onChange={(e) => setIpInterval(e.target.value)}
                    className="w-full bg-[#121212] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#1e88e5] text-white p-2.5 rounded font-bold hover:bg-[#1565c0] transition-all duration-100"
              >
                Guardar Configuración
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ADD UNIT FORM MODAL OVERLAY */}
      {isAddingUnit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-55 p-4">
          <div className="bg-[#1c1c1c] border border-[#262626] rounded-lg w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#262626] bg-[#121212] flex items-center justify-between">
              <h4 className="font-bold text-sm text-white uppercase tracking-wide">
                Agregar Nueva Unidad
              </h4>
              <button onClick={() => setIsAddingUnit(false)} className="text-gray-500 hover:text-white text-xs">
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="p-6 space-y-4 text-xs text-left">
              <div className="space-y-1.5">
                <label className="text-gray-400 font-semibold">ID Oficial (Número Único)</label>
                <input
                  type="number"
                  placeholder="Ej. 22"
                  value={newUnitId}
                  onChange={(e) => setNewUnitId(e.target.value)}
                  className="w-full bg-[#121212] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none focus:border-[#1e88e5]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 font-semibold">Nombre de la Unidad</label>
                <input
                  type="text"
                  placeholder="Ej. OOADBC, UMF 32 ENS"
                  value={newUnitNombre}
                  onChange={(e) => setNewUnitNombre(e.target.value)}
                  className="w-full bg-[#121212] border border-[#262626] rounded p-2 text-white focus:outline-none focus:border-[#1e88e5]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 font-semibold">Ciudad</label>
                <select
                  value={newUnitCityId}
                  onChange={(e) => setNewUnitCityId(e.target.value)}
                  className="w-full bg-[#121212] border border-[#262626] rounded p-2 text-white focus:outline-none focus:border-[#1e88e5]"
                  required
                >
                  <option value="">Seleccione una ciudad...</option>
                  <option value="MXL">Mexicali</option>
                  <option value="TIJ">Tijuana</option>
                  <option value="ENS">Ensenada</option>
                  <option value="SLRC">San Luis RC</option>
                  <option value="TKT">Tecate</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 font-semibold">Tipo de Unidad</label>
                <select
                  value={newUnitTipo}
                  onChange={(e) => setNewUnitTipo(e.target.value)}
                  className="w-full bg-[#121212] border border-[#262626] rounded p-2 text-white focus:outline-none focus:border-[#1e88e5]"
                  required
                >
                  <option value="">Seleccione un tipo...</option>
                  <option value="Hospital">Hospital</option>
                  <option value="UMF">UMF</option>
                  <option value="Subdelegación">Subdelegación</option>
                  <option value="Oficinas">Oficinas</option>
                  <option value="Guardería">Guardería</option>
                  <option value="Almacén">Almacén</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-[#1e88e5] text-white p-2.5 rounded font-bold hover:bg-[#1565c0] transition-all duration-100"
              >
                Registrar Unidad
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. HISTORIAL & CONSULTAS PAGE
// ==========================================
function TicketsPage({
  initialSelectedTicketId,
  setInitialSelectedTicketId
}: {
  initialSelectedTicketId: number | null;
  setInitialSelectedTicketId: (id: number | null) => void;
}) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("");
  const [cityId, setCityId] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Detail Modal States
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<number[]>([]);
  const [ticketProveedorInput, setTicketProveedorInput] = useState("");

  useEffect(() => {
    if (initialSelectedTicketId) {
      openTicket({ id: initialSelectedTicketId });
      setInitialSelectedTicketId(null);
    }
  }, [initialSelectedTicketId]);

  useEffect(() => {
    if (selectedTicket) {
      setTicketProveedorInput(selectedTicket.ticketProveedor || "");
    }
  }, [selectedTicket]);

  useEffect(() => {
    loadTickets();
  }, [search, estado, cityId, dateStart, dateEnd, page]);

  const loadTickets = async () => {
    setLoading(true);
    setSelectedTicketIds([]);
    try {
      const url = `${API_URL}/api/tickets?search=${encodeURIComponent(search)}&estado=${estado}&cityId=${cityId}&dateStart=${dateStart}&dateEnd=${dateEnd}&page=${page}&limit=15`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.data || []);
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openTicket = async (t: any) => {
    try {
      const res = await fetch(`${API_URL}/api/tickets/${t.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTicket(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseTicket = async (ticketId: number) => {
    const reason = prompt("Ingrese observaciones o notas para el cierre del ticket:");
    if (reason === null) return; // User cancelled
    const trimmed = reason.trim();
    if (!trimmed) {
      alert("Debe especificar observaciones para cerrar el ticket.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/tickets/${ticketId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observaciones: trimmed })
      });
      if (res.ok) {
        alert("Ticket cerrado exitosamente.");
        setSelectedTicket(null);
        loadTickets();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error al cerrar el ticket.");
    }
  };

  const handleDeleteTicket = async (ticketId: number, folio: string) => {
    if (!confirm(`¿Está seguro de eliminar permanentemente el ticket "${folio}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/tickets/${ticketId}`, { method: "DELETE" });
      if (res.ok) {
        alert("Ticket eliminado exitosamente.");
        loadTickets();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error al eliminar el ticket.");
    }
  };

  const handleDeleteRange = async () => {
    const start = prompt("Ingrese la fecha de inicio del rango a eliminar (AAAA-MM-DD):");
    if (start === null) return;
    const end = prompt("Ingrese la fecha de fin del rango a eliminar (AAAA-MM-DD):");
    if (end === null) return;

    const startTrimmed = start.trim();
    const endTrimmed = end.trim();
    if (!startTrimmed || !endTrimmed) {
      alert("Debe especificar ambas fechas (Inicio y Fin) para eliminar un rango.");
      return;
    }

    if (!confirm(`¿Está seguro de eliminar permanentemente TODOS los tickets del rango ${startTrimmed} al ${endTrimmed}? Esta acción no se puede deshacer.`)) return;

    try {
      const res = await fetch(`${API_URL}/api/tickets`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: startTrimmed, endDate: endTrimmed })
      });
      if (res.ok) {
        alert("Tickets eliminados exitosamente.");
        loadTickets();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error al eliminar los tickets.");
    }
  };

  const handleSaveTicketProveedor = async () => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`${API_URL}/api/tickets/${selectedTicket.id}/proveedor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketProveedor: ticketProveedorInput.trim() })
      });
      if (res.ok) {
        alert("Ticket Proveedor actualizado correctamente.");
        setSelectedTicket({
          ...selectedTicket,
          ticketProveedor: ticketProveedorInput.trim()
        });
        loadTickets();
      } else {
        alert("Error al guardar el ticket de proveedor.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red al guardar el ticket de proveedor.");
    }
  };

  const handleDeleteSelectedTickets = async () => {
    if (selectedTicketIds.length === 0) return;
    if (!confirm(`¿Está seguro de eliminar permanentemente los ${selectedTicketIds.length} tickets seleccionados? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/tickets/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedTicketIds })
      });
      if (res.ok) {
        alert("Tickets eliminados exitosamente.");
        setSelectedTicketIds([]);
        loadTickets();
      } else {
        alert("Error al eliminar los tickets seleccionados.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red al eliminar los tickets.");
    }
  };

  return (
    <div className="space-y-6">
      {/* FILTERS PANEL */}
      <div className="bg-[#121212] p-4 border border-[#262626] rounded flex flex-col xl:flex-row xl:items-center gap-4 justify-between">
        <div className="flex flex-col md:flex-row gap-4 flex-grow w-full xl:w-auto">
          <div className="relative flex-grow md:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por Folio, Unidad, Causa..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-[#1c1c1c] border border-[#262626] rounded pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-4 gap-2 flex-grow">
            <select
              value={estado}
              onChange={(e) => { setEstado(e.target.value); setPage(1); }}
              className="bg-[#1c1c1c] border border-[#262626] rounded p-2 text-xs text-white focus:outline-none"
            >
              <option value="">Todos los estados</option>
              <option value="Abierto">Abierto</option>
              <option value="Cerrado">Cerrado</option>
            </select>
            <select
              value={cityId}
              onChange={(e) => { setCityId(e.target.value); setPage(1); }}
              className="bg-[#1c1c1c] border border-[#262626] rounded p-2 text-xs text-white focus:outline-none"
            >
              <option value="">Todas las ciudades</option>
              <option value="MXL">Mexicali</option>
              <option value="TIJ">Tijuana</option>
              <option value="ENS">Ensenada</option>
              <option value="SLRC">San Luis RC</option>
              <option value="TKT">Tecate</option>
            </select>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => { setDateStart(e.target.value); setPage(1); }}
              className="bg-[#1c1c1c] border border-[#262626] rounded p-2 text-xs text-white focus:outline-none font-mono"
              placeholder="Fecha Inicio"
            />
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => { setDateEnd(e.target.value); setPage(1); }}
              className="bg-[#1c1c1c] border border-[#262626] rounded p-2 text-xs text-white focus:outline-none font-mono"
              placeholder="Fecha Fin"
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto shrink-0">
          {selectedTicketIds.length > 0 && (
            <button
              onClick={handleDeleteSelectedTickets}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold transition-all duration-100 flex items-center justify-center text-xs"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Borrar Seleccionados ({selectedTicketIds.length})
            </button>
          )}
          <button
            onClick={handleDeleteRange}
            className="w-full sm:w-auto bg-red-600/10 text-red-500 border border-red-600/20 hover:bg-red-600/25 px-4 py-2 rounded font-bold transition-all duration-100 flex items-center justify-center text-xs"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Borrar por Rango
          </button>
        </div>
      </div>

      {/* TICKETS TABLE */}
      <div className="bg-[#121212] border border-[#262626] rounded">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0f0f0f] border-b border-[#262626] text-gray-400 font-mono uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={tickets.length > 0 && selectedTicketIds.length === tickets.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTicketIds(tickets.map(t => t.id));
                      } else {
                        setSelectedTicketIds([]);
                      }
                    }}
                    className="rounded bg-[#1c1c1c] border-[#262626] text-[#1e88e5] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="p-3">Folio</th>
                <th className="p-3">Unidad</th>
                <th className="p-3">Ciudad</th>
                <th className="p-3">Inicio</th>
                <th className="p-3">Fin / Cierre</th>
                <th className="p-3">Duración</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-500">Cargando bitácora de tickets...</td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-500">No se encontraron tickets con los filtros aplicados.</td>
                </tr>
              ) : (
                tickets.map((t, idx) => (
                  <tr key={idx} className="hover:bg-[#181818] transition-colors duration-100">
                    <td className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedTicketIds.includes(t.id)}
                        onChange={() => {
                          if (selectedTicketIds.includes(t.id)) {
                            setSelectedTicketIds(selectedTicketIds.filter(id => id !== t.id));
                          } else {
                            setSelectedTicketIds([...selectedTicketIds, t.id]);
                          }
                        }}
                        className="rounded bg-[#1c1c1c] border-[#262626] text-[#1e88e5] focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-mono text-[#1e88e5] font-bold">{t.folio}</td>
                    <td className="p-3 font-semibold">{t.unidadNombre}</td>
                    <td className="p-3">{t.ciudadNombre}</td>
                    <td className="p-3 font-mono">{t.fechaInicio} {t.horaInicio}</td>
                    <td className="p-3 font-mono text-gray-400">
                      {t.fechaFin ? `${t.fechaFin} ${t.horaFin}` : <span className="text-red-400">Abierto</span>}
                    </td>
                    <td className="p-3 font-mono text-gray-400">{t.duracionLegible}</td>
                    <td className="p-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${t.estado === "Abierto" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                        }`}>
                        {t.estado}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => openTicket(t)}
                          className="text-xs text-[#1e88e5] hover:underline"
                        >
                          Ver Detalle
                        </button>
                        <button
                          onClick={() => handleDeleteTicket(t.id, t.folio)}
                          className="text-gray-500 hover:text-red-500 transition-colors p-1"
                          title="Eliminar ticket"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* PAGINATION PANEL */}
        <div className="px-4 py-3 border-t border-[#262626] bg-[#0d0d0d] flex items-center justify-between text-gray-400">
          <span>Total tickets: <b className="text-gray-200">{totalCount}</b></span>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded bg-[#262626] hover:bg-[#333] disabled:bg-gray-800 disabled:text-gray-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 bg-[#1a1a1a] rounded text-white font-semibold font-mono">Pág. {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={tickets.length < 15}
              className="p-1.5 rounded bg-[#262626] hover:bg-[#333] disabled:bg-gray-800 disabled:text-gray-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* TICKET DETAIL MODAL */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#121212] border border-[#262626] rounded-lg w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#262626] bg-[#0d0d0d] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-500 font-mono">INCIDENCIA DE RED</span>
                <h3 className="font-bold text-sm text-white">Detalle de Ticket {selectedTicket.folio}</h3>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-[#262626]">
                Cerrar
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-[#181818] p-4 rounded space-y-2 font-mono text-[11px]">
                <div className="flex justify-between border-b border-[#262626] pb-1">
                  <span className="text-gray-500">Unidad Afectada:</span>
                  <span className="text-gray-300 font-bold">{selectedTicket.unidadNombre} ({selectedTicket.unidadTipo}) - ID: {selectedTicket.unitId}</span>
                </div>
                <div className="flex justify-between border-b border-[#262626] pb-1">
                  <span className="text-gray-500">Ciudad:</span>
                  <span className="text-gray-300">{selectedTicket.ciudadNombre}</span>
                </div>
                <div className="flex justify-between border-b border-[#262626] pb-1">
                  <span className="text-gray-500">Inicio de Caída:</span>
                  <span className="text-red-400">{selectedTicket.fechaInicio} {selectedTicket.horaInicio}</span>
                </div>
                <div className="flex justify-between border-b border-[#262626] pb-1">
                  <span className="text-gray-500">Recuperación:</span>
                  <span className="text-green-400">{selectedTicket.fechaFin ? `${selectedTicket.fechaFin} ${selectedTicket.horaFin}` : "Abierto (Activo)"}</span>
                </div>
                <div className="flex justify-between border-b border-[#262626] pb-1">
                  <span className="text-gray-500">Duración Acumulada:</span>
                  <span className="text-gray-300 font-semibold">{selectedTicket.duracionLegible}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Generación:</span>
                  <span className="text-gray-500">{selectedTicket.creadoAutomaticamente === 1 ? "Automático (Monitor)" : "Manual"}</span>
                </div>
                {selectedTicket.ticketProveedor && (
                  <div className="flex justify-between border-t border-[#262626] pt-1 mt-1">
                    <span className="text-gray-500">Ticket Proveedor:</span>
                    <span className="text-[#1e88e5] font-bold font-mono">{selectedTicket.ticketProveedor}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Causa e Impacto</span>
                <div className="bg-[#0f0f0f] border border-[#262626] p-3 rounded text-gray-300">
                  {selectedTicket.motivo}
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Ticket Proveedor</span>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={ticketProveedorInput}
                    onChange={(e) => setTicketProveedorInput(e.target.value)}
                    placeholder="Ej. TKT-82931-PROV"
                    className="flex-grow bg-[#0f0f0f] border border-[#262626] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#1e88e5]"
                  />
                  <button
                    onClick={handleSaveTicketProveedor}
                    className="bg-[#1e88e5] hover:bg-[#1565c0] text-white px-4 py-1.5 rounded font-bold text-xs transition-colors shrink-0 font-sans"
                  >
                    Guardar
                  </button>
                </div>
              </div>

              {selectedTicket.details && selectedTicket.details.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Enlaces Afectados (IPs)</span>
                  <div className="space-y-1.5">
                    {selectedTicket.details.map((d: any, i: number) => (
                      <div key={i} className="flex justify-between items-center bg-[#181818] p-2 border border-[#262626] rounded">
                        <div>
                          <div className="font-bold font-mono text-[11px] text-gray-200">{d.direccionIP}</div>
                          <div className="text-[10px] text-gray-500">{d.ipDescripcion}</div>
                        </div>
                        <span className="text-[10px] font-mono text-red-400 uppercase">Caído</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedTicket.estado === "Abierto" && (
                <div className="border-t border-[#262626] pt-4 flex justify-end">
                  <button
                    onClick={() => handleCloseTicket(selectedTicket.id)}
                    className="bg-amber-600/10 text-amber-500 border border-amber-600/20 hover:bg-amber-600/25 px-4 py-2 rounded font-bold transition-all duration-100 text-xs"
                  >
                    Cerrar Ticket Manualmente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4. REPORTES PAGE
// ==========================================
function ReportsPage({ globalSettings }: { globalSettings: any }) {
  const [type, setType] = useState("tickets"); // 'tickets', 'units', 'logs'
  const [format, setFormat] = useState("pdf"); // 'pdf', 'excel', 'csv'
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");

  const handleRunReport = async () => {
    setGenerating(true);
    setMsg("Generando reporte local...");
    try {
      let url = `${API_URL}/api/exports/run?type=${type}&format=${format}`;
      if (type === "tickets" && startDate) {
        url += `&startDate=${startDate}`;
      }
      if (type === "tickets" && endDate) {
        url += `&endDate=${endDate}`;
      }
      // Since it triggers download, we open in new tab or execute fetch blob download
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to generate report file");
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Reporte_${type.toUpperCase()}_${new Date().toISOString().substring(0, 10)}.${format === "excel" ? "xlsx" : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMsg("Reporte descargado exitosamente.");
    } catch (err: any) {
      setMsg(`Falla al exportar reporte: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-[#121212] border border-[#262626] rounded max-w-lg mx-auto p-6 space-y-6 text-xs">
      <div className="border-b border-[#262626] pb-3">
        <h3 className="font-bold text-sm text-white uppercase tracking-wide">EXPORTACIÓN DE REPORTES LOCALES</h3>
        <p className="text-gray-500 text-[11px] mt-1">
          La exportación se realiza enteramente en el servidor local. El archivo se guardará en la carpeta configurada.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-gray-400 font-semibold">Tipo de Datos a Exportar</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white focus:outline-none"
          >
            <option value="tickets">Bitácora Histórica de Tickets</option>
            <option value="units">Catálogo de Unidades y Enlaces IPs</option>
            <option value="logs">Bitácora de Logs del Sistema (Historial Reciente)</option>
          </select>
        </div>

        {type === "tickets" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-400 font-semibold">Fecha Inicio (Desde)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none focus:border-[#1e88e5]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-400 font-semibold">Fecha Fin (Hasta)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none focus:border-[#1e88e5]"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-gray-400 font-semibold">Formato de Archivo</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "pdf", label: "Documento PDF", desc: "Listo para impresión" },
              { id: "excel", label: "Hoja Excel (.xlsx)", desc: "Listo para análisis" },
              { id: "csv", label: "Separado por Comas (.csv)", desc: "Mayor compatibilidad" }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                className={`p-3 border rounded text-center transition-all ${format === f.id
                  ? "bg-[#1e88e5]/10 border-[#1e88e5] text-white"
                  : "bg-[#1c1c1c] border-[#262626] text-gray-400 hover:text-white"
                  }`}
              >
                <div className="font-bold text-[11px]">{f.label}</div>
                <div className="text-[9px] text-gray-500 mt-1">{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <div className="bg-[#1c1c1c] border border-[#262626] text-gray-300 p-3 rounded text-[11px] font-mono">
            {msg}
          </div>
        )}

        <button
          onClick={handleRunReport}
          disabled={generating}
          className="w-full bg-[#1e88e5] text-white p-2.5 rounded font-bold hover:bg-[#1565c0] transition-all disabled:bg-gray-700 flex items-center justify-center space-x-2"
        >
          {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span>{generating ? "Generando Reporte..." : "Exportar y Descargar Archivo"}</span>
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 5. IMPORTACIONES PAGE
// ==========================================
function ImportsPage() {
  const [importType, setImportType] = useState("units"); // 'cities', 'units', 'rooms'
  const [fileContent, setFileContent] = useState("");
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    loadImportHistory();
  }, []);

  const loadImportHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/imports`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
      setValidationResult(null);
    };
    reader.readAsText(file);
  };

  const handleValidate = () => {
    setValidationResult(null);
    try {
      const parsed = JSON.parse(fileContent);
      if (!Array.isArray(parsed)) {
        setValidationResult({ success: false, error: "El archivo JSON debe contener un arreglo de objetos." });
        return;
      }
      setValidationResult({
        success: true,
        count: parsed.length,
        message: `El formato JSON es sintácticamente válido. Contiene ${parsed.length} registros listos para validar en base de datos.`
      });
    } catch (err: any) {
      setValidationResult({ success: false, error: `Error de sintaxis JSON: ${err.message}` });
    }
  };

  const handleRunImport = async () => {
    if (!validationResult || !validationResult.success) return;
    setImporting(true);
    try {
      const res = await fetch(`${API_URL}/api/imports?type=${importType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: fileContent
      });

      const data = await res.json();
      if (res.ok) {
        alert("Catálogo importado exitosamente. Se aplicaron todas las validaciones de negocio.");
        setFileContent("");
        setValidationResult(null);
        loadImportHistory();
      } else {
        alert(`Error en importación:\n${data.details || data.error}`);
      }
    } catch (err: any) {
      alert(`Falla de red: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
      {/* IMPORT FORM */}
      <div className="bg-[#121212] border border-[#262626] rounded p-6 space-y-4">
        <div className="border-b border-[#262626] pb-3">
          <h3 className="font-bold text-sm text-white uppercase tracking-wide">IMPORTACIÓN DE CATÁLOGOS JSON</h3>
          <p className="text-gray-500 text-[11px] mt-1">
            Solo se permiten cargas transaccionales estrictas. Si ocurre algún error, se cancela todo el proceso.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-gray-400 font-semibold">Tipo de Catálogo</label>
          <select
            value={importType}
            onChange={(e) => { setImportType(e.target.value); setValidationResult(null); }}
            className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white focus:outline-none"
          >
            <option value="cities">Ciudades (cities.json)</option>
            <option value="units">Unidades Médicas y Oficinas (units.json)</option>
            <option value="rooms">Cuartos de Enlace (rooms.json)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-gray-400 font-semibold">Seleccionar Archivo JSON</label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white focus:outline-none cursor-pointer"
          />
        </div>

        {fileContent && (
          <button
            onClick={handleValidate}
            className="bg-[#262626] hover:bg-[#333] text-white py-2 px-4 rounded font-bold"
          >
            Validar Sintaxis
          </button>
        )}

        {validationResult && (
          <div className={`p-4 rounded border ${validationResult.success
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-red-500/10 border-red-500/20 text-red-500"
            }`}>
            <div className="font-bold flex items-center space-x-1.5 mb-1">
              {validationResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <span>{validationResult.success ? "Sintaxis Correcta" : "Error de Validación"}</span>
            </div>
            <p className="text-[11px] leading-relaxed font-mono whitespace-pre-line">
              {validationResult.success ? validationResult.message : validationResult.error}
            </p>
          </div>
        )}

        {validationResult?.success && (
          <button
            onClick={handleRunImport}
            disabled={importing}
            className="w-full bg-[#1e88e5] text-white p-2.5 rounded font-bold hover:bg-[#1565c0] transition-all flex items-center justify-center space-x-2"
          >
            {importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{importing ? "Importando..." : "Confirmar e Importar a Base de Datos"}</span>
          </button>
        )}
      </div>

      {/* IMPORT HISTORY */}
      <div className="bg-[#121212] border border-[#262626] rounded flex flex-col h-[400px]">
        <div className="px-4 py-3 border-b border-[#262626] bg-[#0d0d0d]">
          <span className="font-bold text-sm tracking-wide">HISTORIAL DE IMPORTACIONES</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-600 text-xs">Sin cargas previas registradas</div>
          ) : (
            history.map((h, i) => (
              <div key={i} className={`p-3 rounded text-xs border ${h.resultado === "EXITOSO" ? "bg-green-500/5 border-green-950/20" : "bg-red-500/5 border-red-950/20"
                } space-y-1`}>
                <div className="flex justify-between font-bold">
                  <span className={h.resultado === "EXITOSO" ? "text-green-500" : "text-red-500"}>{h.resultado}</span>
                  <span className="text-gray-500 font-mono">{h.fecha} {h.hora}</span>
                </div>
                <div className="text-gray-300 font-mono text-[11px]">Tipo: {h.tipoArchivo} | Registros: {h.registrosImportados}</div>
                {h.errores && <div className="text-[10px] text-red-400 font-mono mt-1 break-all truncate line-clamp-1">{h.errores}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 6. RESPALDOS & RESTAURACIÓN PAGE
// ==========================================
function BackupsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      const res = await fetch(`${API_URL}/api/backups`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/backups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automatico: false })
      });
      if (res.ok) {
        alert("Respaldo comprimido creado exitosamente en la ruta local.");
        loadBackups();
      } else {
        alert("Falla al generar respaldo local.");
      }
    } catch (err: any) {
      alert("Error de red: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (id: number) => {
    if (!confirm("ADVERTENCIA CRÍTICA: Restaurar un respaldo reemplazará toda la base de datos actual. ¿Está absolutamente seguro de continuar? (Se generará un respaldo de seguridad del estado actual antes de sobrescribir).")) return;
    setRestoring(true);
    try {
      const res = await fetch(`${API_URL}/api/backups/restore/${id}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert("Base de datos restaurada correctamente. La interfaz de usuario ha sido recargada.");
        loadBackups();
      } else {
        alert(`Error al restaurar: ${data.error}`);
      }
    } catch (err: any) {
      alert("Error de red: " + err.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      {/* TRIGGER PANEL */}
      <div className="bg-[#121212] border border-[#262626] rounded p-6 space-y-4">
        <div className="border-b border-[#262626] pb-3">
          <h3 className="font-bold text-sm text-white uppercase tracking-wide">GESTIÓN DE RESPALDOS LOCALES</h3>
          <p className="text-gray-500 text-[11px] mt-1">
            Los respaldos comprimen la base de datos SQLite actual en formato ZIP y los archivan localmente para protección y auditoría.
          </p>
        </div>

        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="w-full bg-[#1e88e5] text-white p-3 rounded font-bold hover:bg-[#1565c0] transition-all disabled:bg-gray-700 flex items-center justify-center space-x-2"
        >
          {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <DbIcon className="h-4 w-4" />}
          <span>{creating ? "Generando Respaldo..." : "Crear Respaldo Manual Ahora"}</span>
        </button>

        <div className="p-3 bg-[#1c1c1c] border border-[#262626] rounded space-y-1.5 leading-relaxed text-gray-400 text-[11px]">
          <div className="font-bold text-gray-300">Detalles técnicos:</div>
          <div>• Base de datos: <b>SQLite (sme.db)</b></div>
          <div>• Compresión: <b>Estándar ZIP</b></div>
          <div>• Seguridad: <b>Rollback de restauración ante fallas</b></div>
        </div>
      </div>

      {/* HISTORY TABLE */}
      <div className="bg-[#121212] border border-[#262626] rounded lg:col-span-2 flex flex-col h-[500px]">
        <div className="px-4 py-3 border-b border-[#262626] bg-[#0d0d0d]">
          <span className="font-bold text-sm tracking-wide">HISTORIAL DE RESPALDOS EN DISCO</span>
        </div>
        <div className="flex-grow overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0f0f0f] border-b border-[#262626] text-gray-400 font-mono">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Fecha / Hora</th>
                <th className="p-3">Tamaño (KB)</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Resultado</th>
                <th className="p-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">Sin respaldos registrados en la base de datos</td>
                </tr>
              ) : (
                history.map((b, i) => (
                  <tr key={i} className="hover:bg-[#181818]">
                    <td className="p-3 font-mono">{b.id}</td>
                    <td className="p-3 font-mono">{b.fecha} {b.hora}</td>
                    <td className="p-3 font-mono">{(b.tamano / 1024).toFixed(1)} KB</td>
                    <td className="p-3">
                      <span className="text-gray-400">{b.automatico === 1 ? "Automático" : "Manual"}</span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${b.resultado === "EXITOSO" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                        }`}>
                        {b.resultado}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {b.resultado === "EXITOSO" && (
                        <button
                          onClick={() => handleRestore(b.id)}
                          disabled={restoring}
                          className="text-xs text-red-400 hover:text-red-300 font-bold hover:underline"
                        >
                          Restaurar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 7. CONFIGURACIÓN PAGE
// ==========================================
function SettingsPage({ settings, fetchSettings }: { settings: any; fetchSettings: () => void }) {
  const [pingInterval, setPingInterval] = useState(30);
  const [failuresLimit, setFailuresLimit] = useState(10);
  const [recoveriesLimit, setRecoveriesLimit] = useState(3);
  const [timeoutLimit, setTimeoutLimit] = useState(1000);
  const [instName, setInstName] = useState("");
  const [backupsPath, setBackupsPath] = useState("");
  const [exportsPath, setExportsPath] = useState("");
  const [sondaIp, setSondaIp] = useState("11.1.2.254");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (settings) {
      setPingInterval(settings.intervaloPing);
      setFailuresLimit(settings.fallosConsecutivos);
      setRecoveriesLimit(settings.recuperacionesConsecutivas);
      setTimeoutLimit(settings.timeout);
      setInstName(settings.nombreInstitucion);
      setBackupsPath(settings.rutaRespaldos || "");
      setExportsPath(settings.rutaExportaciones || "");
      setSondaIp(settings.sondaIp || "11.1.2.254");
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidIPv4(sondaIp)) {
      alert("La IP de la Sonda Principal debe tener un formato IPv4 válido.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intervaloPing: pingInterval,
          fallosConsecutivos: failuresLimit,
          recuperacionesConsecutivas: recoveriesLimit,
          timeout: timeoutLimit,
          rutaRespaldos: backupsPath,
          rutaExportaciones: exportsPath,
          nombreInstitucion: instName,
          actualizacionAutomatica: true,
          sondaIp: sondaIp
        })
      });
      if (res.ok) {
        alert("Configuración global actualizada correctamente.");
        fetchSettings();
      } else {
        alert("Error al actualizar configuración.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-[#121212] border border-[#262626] rounded max-w-xl mx-auto p-6 space-y-6 text-xs">
      <div className="border-b border-[#262626] pb-3">
        <h3 className="font-bold text-sm text-white uppercase tracking-wide">CONFIGURACIÓN PARÁMETROS GLOBALES</h3>
        <p className="text-gray-500 text-[11px] mt-1">
          Define el comportamiento estándar para las IPs y rutas que no tengan una configuración local explícita.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-gray-400 font-semibold">Frecuencia de Pings (Segundos)</label>
            <input
              type="number"
              value={pingInterval}
              onChange={(e) => setPingInterval(parseInt(e.target.value))}
              className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none"
              min="5"
              max="3600"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-gray-400 font-semibold">Timeout de Respuesta (ms)</label>
            <input
              type="number"
              value={timeoutLimit}
              onChange={(e) => setTimeoutLimit(parseInt(e.target.value))}
              className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none"
              min="100"
              max="10000"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-gray-400 font-semibold">Fallos para Confirmar Caída</label>
            <input
              type="number"
              value={failuresLimit}
              onChange={(e) => setFailuresLimit(parseInt(e.target.value))}
              className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none"
              min="1"
              max="100"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-gray-400 font-semibold">Recuperaciones para Confirmar Cierre</label>
            <input
              type="number"
              value={recoveriesLimit}
              onChange={(e) => setRecoveriesLimit(parseInt(e.target.value))}
              className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none"
              min="1"
              max="100"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-gray-400 font-semibold">Nombre de la Institución / Unidad</label>
            <input
              type="text"
              value={instName}
              onChange={(e) => setInstName(e.target.value)}
              className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white focus:outline-none"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-gray-400 font-semibold">IP de Sonda Principal</label>
            <input
              type="text"
              value={sondaIp}
              onChange={(e) => setSondaIp(e.target.value)}
              className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none"
              placeholder="e.g. 11.1.2.254"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-gray-400 font-semibold">Ruta Local para Respaldos</label>
          <input
            type="text"
            value={backupsPath}
            onChange={(e) => setBackupsPath(e.target.value)}
            className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-gray-400 font-semibold">Ruta Local para Exportaciones</label>
          <input
            type="text"
            value={exportsPath}
            onChange={(e) => setExportsPath(e.target.value)}
            className="w-full bg-[#1c1c1c] border border-[#262626] rounded p-2 text-white font-mono focus:outline-none"
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#1e88e5] text-white p-2.5 rounded font-bold hover:bg-[#1565c0] transition-all disabled:bg-gray-700"
        >
          {submitting ? "Guardando..." : "Guardar Configuración Global"}
        </button>
      </div>
    </form>
  );
}

// ==========================================
// 8. LOGS DEL SISTEMA PAGE
// ==========================================
function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [nivel, setNivel] = useState("");
  const [modulo, setModulo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [search, nivel, modulo, page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const url = `${API_URL}/api/logs?search=${encodeURIComponent(search)}&nivel=${nivel}&modulo=${encodeURIComponent(modulo)}&page=${page}&limit=25`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("¿Está seguro de eliminar permanentemente TODOS los registros de la bitácora? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/logs`, {
        method: "DELETE"
      });
      if (res.ok) {
        alert("Bitácora de logs limpiada correctamente.");
        setPage(1);
        loadLogs();
      } else {
        alert("Error al limpiar la bitácora.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red al intentar limpiar los logs.");
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {/* FILTER HEADER */}
      <div className="bg-[#121212] p-4 border border-[#262626] rounded flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 flex-grow w-full lg:w-auto">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar en descripción de eventos..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-[#1c1c1c] border border-[#262626] rounded pl-9 pr-4 py-2 text-xs text-white focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 w-full md:w-[350px]">
            <select
              value={nivel}
              onChange={(e) => { setNivel(e.target.value); setPage(1); }}
              className="bg-[#1c1c1c] border border-[#262626] rounded p-2 text-xs text-white focus:outline-none"
            >
              <option value="">Todos los niveles</option>
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <select
              value={modulo}
              onChange={(e) => { setModulo(e.target.value); setPage(1); }}
              className="bg-[#1c1c1c] border border-[#262626] rounded p-2 text-xs text-white focus:outline-none"
            >
              <option value="">Todos los módulos</option>
              <option value="Servicio Monitor">Servicio Monitor</option>
              <option value="API">API</option>
              <option value="Configuración">Configuración</option>
              <option value="Importación">Importación</option>
              <option value="Respaldos">Respaldos</option>
              <option value="Tickets">Tickets</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleClearLogs}
          className="w-full lg:w-auto shrink-0 bg-red-600/10 text-red-500 border border-red-600/20 hover:bg-red-600/25 px-4 py-2 rounded font-bold transition-all duration-100 flex items-center justify-center text-xs"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Limpiar Bitácora
        </button>
      </div>

      {/* LOGS LIST */}
      <div className="bg-[#121212] border border-[#262626] rounded flex flex-col h-[500px]">
        <div className="overflow-y-auto flex-1 font-mono text-[11px] leading-relaxed p-4 divide-y divide-[#262626]/40">
          {loading ? (
            <div className="py-12 text-center text-gray-500">Cargando registros de auditoría...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-gray-500">Sin logs encontrados.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="py-2 flex items-start space-x-3 hover:bg-[#181818]">
                <span className="text-gray-500 select-none">{log.fechaHora?.substring(0, 19).replace("T", " ")}</span>
                <span className={`font-bold inline-block w-20 shrink-0 ${log.nivel === "INFO" ? "text-blue-400" :
                  log.nivel === "WARNING" ? "text-yellow-400" :
                    log.nivel === "ERROR" ? "text-red-400" :
                      log.nivel === "CRITICAL" ? "text-red-600 animate-pulse" : "text-gray-500"
                  }`}>
                  [{log.nivel}]
                </span>
                <span className="text-gray-400 shrink-0 w-28">[{log.modulo}]</span>
                <span className="text-gray-200 flex-1">{log.descripcion}</span>
              </div>
            ))
          )}
        </div>

        {/* PAGINATION PANEL */}
        <div className="px-4 py-3 border-t border-[#262626] bg-[#0d0d0d] flex items-center justify-between text-gray-400">
          <span>Total logs: <b className="text-gray-200">{total}</b></span>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded bg-[#262626] hover:bg-[#333] disabled:bg-gray-800 disabled:text-gray-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 bg-[#1a1a1a] rounded text-white font-semibold font-mono">Pág. {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={logs.length < 25}
              className="p-1.5 rounded bg-[#262626] hover:bg-[#333] disabled:bg-gray-800 disabled:text-gray-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 9. ACERCA DEL SISTEMA PAGE
// ==========================================
function AboutPage({ status }: { status: any }) {
  return (
    <div className="bg-[#121212] border border-[#262626] rounded max-w-md mx-auto p-6 text-xs space-y-6">
      <div className="text-center space-y-2">
        <Activity className="h-12 w-12 text-[#1e88e5] mx-auto animate-pulse" />
        <h3 className="font-bold text-sm text-white uppercase tracking-wider">Sistema de Monitoreo de Enlaces</h3>
        <p className="text-gray-500 font-mono text-[10px]">Versión 1.2.0 (Local Build)</p>
      </div>

      <div className="border-t border-[#262626] pt-4 space-y-3 leading-relaxed text-gray-300">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Información de Desarrollo</div>
        <div>
          Desarrollado para la coordinación de <b>Telecomunicaciones del IMSS Órgano de Operación Administrativa Desconcentrada Baja California</b>.
        </div>
        <div>
          • <b>Autor</b>: LSC Israel Díaz Serrano<br />
          • <b>Fecha</b>: Julio 2026<br />
          • <b>Entorno</b>: Local 24/7 (Windows Background Tasks / Service)<br />
          • <b>Copyright</b>: © {new Date().getFullYear()} LSC Israel Díaz Serrano.<br />Todos los derechos reservados.
        </div>
      </div>

      <div className="border-t border-[#262626] pt-4 space-y-2">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Estado de los Módulos</div>
        <div className="flex justify-between items-center bg-[#1c1c1c] p-2 rounded">
          <span>Backend API:</span>
          <span className="font-semibold text-green-500">OPERATIVO</span>
        </div>
        <div className="flex justify-between items-center bg-[#1c1c1c] p-2 rounded">
          <span>Servicio Monitor:</span>
          <span className={`font-semibold ${status.monitor?.estado === "OPERANDO" ? "text-green-500" : "text-red-500"}`}>
            {status.monitor?.estado || "DETENIDO"}
          </span>
        </div>
      </div>
    </div>
  );
}
