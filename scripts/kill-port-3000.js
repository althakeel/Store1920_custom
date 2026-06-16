const { execSync } = require("child_process");

const port = process.argv[2] || "3000";

try {
  const output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
  const pids = new Set();

  output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (!line.includes("LISTENING")) return;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== "0") pids.add(pid);
    });

  if (!pids.size) {
    console.log(`No process is listening on port ${port}.`);
    process.exit(0);
  }

  for (const pid of pids) {
    execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit" });
    console.log(`Stopped process ${pid} on port ${port}.`);
  }
} catch (error) {
  console.log(`No process is listening on port ${port}.`);
}
