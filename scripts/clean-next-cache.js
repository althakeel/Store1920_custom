const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const targets = [".next", path.join("node_modules", ".cache")];

for (const target of targets) {
  const fullPath = path.join(root, target);
  try {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`Removed ${target}`);
  } catch (error) {
    console.warn(`Could not remove ${target}:`, error.message);
  }
}
