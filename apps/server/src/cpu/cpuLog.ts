import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const logDir = join(process.cwd(), "logs", "cpu");

// CPUの判断ログを1判断1ファイルのJSONで書き出す
export function writeCpuLog(log: { timestamp: string; cpuName: string }): void {
  try {
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    const filename = `${log.timestamp.replace(/[:.]/g, "-")}_${log.cpuName}.json`;
    const filepath = join(logDir, filename);
    writeFileSync(filepath, JSON.stringify(log, null, 2), "utf-8");
    console.log(`[CPU] Log written: ${filepath}`);
  } catch (error) {
    console.error("[CPU] Failed to write log:", error);
  }
}
