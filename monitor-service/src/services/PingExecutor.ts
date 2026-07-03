import { spawn } from "child_process";

export interface PingResult {
  status: "ONLINE" | "OFFLINE";
  latency: number | null; // Milliseconds
  errorMsg: string | null;
}

export class PingExecutor {
  static ping(ip: string, timeoutMs: number = 1000): Promise<PingResult> {
    return new Promise((resolve) => {
      // In Windows, ping -n 1 -w timeout IP
      // -n 1: 1 ping attempt
      // -w timeout: timeout in milliseconds
      const process = spawn("ping.exe", ["-n", "1", "-w", timeoutMs.toString(), ip]);
      let stdoutData = "";
      let stderrData = "";

      process.stdout.on("data", (data) => {
        stdoutData += data.toString("latin1"); // Read using latin1 for Spanish character accents
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

        // Parse Windows ping output (English & Spanish)
        // Success match: "tiempo=4ms" / "time=4ms" / "tiempo<1ms" / "time<1ms"
        const latencyMatch = stdoutData.match(/(?:tiempo|time)(?:=|<)(\d+)ms/i);

        if (latencyMatch) {
          const latency = parseInt(latencyMatch[1]);
          return resolve({
            status: "ONLINE",
            latency: latency === 0 ? 1 : latency, // Avoid 0ms, report minimum 1ms
            errorMsg: null
          });
        }

        // Failure parsing
        let errorMsg = "Falla de comunicación";
        if (stdoutData.toLowerCase().includes("espera agotado") || stdoutData.toLowerCase().includes("timed out")) {
          errorMsg = "Timeout";
        } else if (stdoutData.toLowerCase().includes("inaccesible") || stdoutData.toLowerCase().includes("unreachable")) {
          errorMsg = "Host inaccesible";
        } else if (stdoutData.toLowerCase().includes("desconocido") || stdoutData.toLowerCase().includes("unknown")) {
          errorMsg = "Destino desconocido";
        } else {
          // Fallback parsing of error lines
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
