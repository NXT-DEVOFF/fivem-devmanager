/**
 * Copie les assets Monaco Editor dans public/monaco afin que l'editeur
 * fonctionne hors ligne (sans CDN), compatible avec un hebergement Pterodactyl.
 */
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const source = path.join(projectRoot, "node_modules", "monaco-editor", "min", "vs");
const target = path.join(projectRoot, "public", "monaco", "vs");

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
    return;
  }
  fs.copyFileSync(from, to);
}

if (!fs.existsSync(source)) {
  console.warn("[monaco] node_modules/monaco-editor introuvable, copie ignoree.");
  process.exit(0);
}

fs.rmSync(target, { recursive: true, force: true });
copyRecursive(source, target);
console.log(`[monaco] assets copies vers ${path.relative(projectRoot, target)}`);
