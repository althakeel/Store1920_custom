const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const targets = [".next", path.join("node_modules", ".cache")];

for (const target of targets) {
  const fullPath = path.join(root, target);
  try {
    fs.rmSync(fullPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    console.log(`Removed ${target}`);
  } catch (error) {
    if (process.platform === "win32" && target === ".next") {
      try {
        require("child_process").execSync(`cmd /c rmdir /s /q "${fullPath}"`, { stdio: "inherit" });
        console.log(`Removed ${target} (Windows fallback)`);
        continue;
      } catch {
        // fall through
      }
    }
    console.warn(`Could not remove ${target}:`, error.message);
  }
}
