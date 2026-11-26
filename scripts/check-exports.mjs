import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const exportSnapshot = JSON.parse(
  readFileSync(join(root, "scripts/exports-snapshot.json"), "utf8"),
);
const failures = [];
const targets = new Set();

function collect(value) {
  if (typeof value === "string" && value.startsWith("./")) targets.add(value);
  else if (value && typeof value === "object") Object.values(value).forEach(collect);
}

collect(pkg.exports);
for (const field of ["main", "module", "types"]) if (pkg[field]) targets.add(pkg[field]);
for (const target of targets) {
  if (!existsSync(join(root, target))) failures.push(`missing package target: ${target}`);
}

for (const [subpath, expected] of Object.entries(exportSnapshot)) {
  const entry = pkg.exports[subpath];
  if (!entry?.import || !entry?.types) {
    failures.push(`missing import/types export for ${subpath}`);
    continue;
  }
  const runtime = await import(pathToFileURL(join(root, entry.import)));
  const runtimeNames = Object.keys(runtime).sort();
  const declaration = readFileSync(join(root, entry.types), "utf8");
  const typeNames = [...declaration.matchAll(/export\s+type\s+\{([^}]+)\}/g)]
    .flatMap((match) => match[1].split(","))
    .map((name) =>
      name
        .trim()
        .split(/\s+as\s+/)
        .at(-1),
    )
    .filter(Boolean)
    .sort();
  if (JSON.stringify(runtimeNames) !== JSON.stringify([...expected.runtime].sort())) {
    failures.push(`${subpath} runtime exports differ from scripts/exports-snapshot.json`);
  }
  if (JSON.stringify(typeNames) !== JSON.stringify([...expected.types].sort())) {
    failures.push(`${subpath} type exports differ from scripts/exports-snapshot.json`);
  }
}

function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) inspect(file);
    else if (/\.(?:js|mjs|cjs)$/.test(file)) {
      const code = readFileSync(file, "utf8");
      if (/(?:from\s*|import\s*\(|require\s*\()\s*['"](?:@\/|#)/.test(code)) {
        failures.push(`unresolved internal alias: ${file.slice(root.length + 1)}`);
      }
    } else if (file.endsWith(".map")) {
      const map = JSON.parse(readFileSync(file, "utf8"));
      map.sources?.forEach((source, index) => {
        const embedded = map.sourcesContent?.[index];
        const sourcePath = resolve(dirname(file), map.sourceRoot ?? "", source);
        if (!embedded && !existsSync(sourcePath)) {
          failures.push(`source map target missing: ${file.slice(root.length + 1)} -> ${source}`);
        }
      });
    }
  }
}

const dist = join(root, "dist");
if (existsSync(dist)) inspect(dist);
else failures.push("missing dist directory; run build first");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${targets.size} package targets and dist aliases/maps.`);
}
