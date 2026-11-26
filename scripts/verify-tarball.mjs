import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceManifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const [mode, input] = process.argv.slice(2);
if (!["--tarball", "--pack-dir"].includes(mode) || !input) {
  throw new Error(
    "Usage: node scripts/verify-tarball.mjs --tarball <file> | --pack-dir <directory>",
  );
}

let tarball;
let release;
let expectedIntegrity;

if (mode === "--pack-dir") {
  const packDir = resolve(input);
  const plan = JSON.parse(readFileSync(join(packDir, "publish-plan.json"), "utf8"));
  const releases = plan.plan.flat().filter((item) => item.kind === "publish");
  if (releases.length !== 1)
    throw new Error(`Expected one package tarball, found ${releases.length}.`);
  release = releases[0];
  tarball = resolve(packDir, release.tarball.path);
  if (!tarball.startsWith(`${packDir}${sep}`))
    throw new Error("Publish plan tarball escapes its artifact directory.");
  expectedIntegrity = release.tarball.integrity;
} else {
  tarball = resolve(input);
}

if (!existsSync(tarball)) throw new Error(`Missing package tarball: ${tarball}`);
const bytes = readFileSync(tarball);
if (expectedIntegrity) {
  const integrity = `sha256-${createHash("sha256").update(bytes).digest("base64")}`;
  if (integrity !== expectedIntegrity)
    throw new Error("Tarball integrity does not match the Changesets publish plan.");
}

const files = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter((file) => file && file !== "package/");
if (files.some((file) => file.startsWith("/") || file.split("/").includes(".."))) {
  throw new Error("Tarball contains an unsafe path.");
}
const allowed = (file) =>
  file === "package/package.json" ||
  file === "package/README.md" ||
  file === "package/CHANGELOG.md" ||
  file === "package/LICENSE" ||
  file === "package/docs/FAILURE_SEMANTICS.md" ||
  file.startsWith("package/dist/");
const unexpected = files.find((file) => !allowed(file));
if (unexpected) throw new Error(`Unexpected tarball file: ${unexpected}`);

const packageJson = JSON.parse(
  execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }),
);
const expectedFiles = [
  "package/dist/exports/index.js",
  "package/dist/exports/index.d.ts",
  "package/dist/exports/index.js.map",
  "package/dist/plugin/payload-plugin.js",
  "package/dist/plugin/payload-plugin.d.ts",
  "package/README.md",
  "package/CHANGELOG.md",
  "package/LICENSE",
  "package/docs/FAILURE_SEMANTICS.md",
];
for (const file of expectedFiles) {
  if (!files.includes(file)) throw new Error(`Missing tarball file: ${file}`);
}
if (packageJson.name !== sourceManifest.name || packageJson.version !== sourceManifest.version) {
  throw new Error("Tarball package name or version does not match the source manifest.");
}
if (release && (packageJson.name !== release.name || packageJson.version !== release.version)) {
  throw new Error("Tarball identity does not match the Changesets publish plan.");
}
if (packageJson.private === true) throw new Error("Published package must not be private.");
if (
  packageJson.repository?.url !== "git+https://github.com/klnap/payload-redirect.git" ||
  packageJson.publishConfig?.access !== "public" ||
  packageJson.publishConfig?.registry !== "https://registry.npmjs.org/"
) {
  throw new Error("Tarball repository or registry metadata is invalid.");
}
if (
  Object.keys(packageJson.exports ?? {}).join() !== "." ||
  packageJson.exports["."].import !== "./dist/exports/index.js" ||
  packageJson.exports["."].types !== "./dist/exports/index.d.ts"
) {
  throw new Error("Tarball public exports do not match the package distribution.");
}

const consumerDir =
  process.env.CONSUMER_DIR ?? mkdtempSync(join(tmpdir(), "payload-redirect-consumer-"));
rmSync(consumerDir, { recursive: true, force: true });
mkdirSync(consumerDir, { recursive: true });
const peerPackages = Object.entries(packageJson.peerDependencies ?? {})
  .filter(([name]) => sourceManifest.devDependencies[name])
  .map(([name]) => `${name}@${sourceManifest.devDependencies[name]}`);
execFileSync(
  "npm",
  [
    "install",
    "--prefix",
    consumerDir,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarball,
    ...peerPackages,
  ],
  { cwd: root, stdio: "inherit" },
);

for (const fixture of ["consumer.ts", "no-generated-types.ts"]) {
  copyFileSync(join(root, "type-fixture", fixture), join(consumerDir, fixture));
}
const compilerOptions = {
  target: "ES2022",
  module: "NodeNext",
  moduleResolution: "NodeNext",
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
};
for (const [config, file] of [
  ["tsconfig.json", "consumer.ts"],
  ["tsconfig.no-generated.json", "no-generated-types.ts"],
]) {
  writeFileSync(
    join(consumerDir, config),
    JSON.stringify({ compilerOptions, include: [file] }, null, 2),
  );
  execFileSync(
    process.execPath,
    [join(root, "node_modules/typescript/bin/tsc"), "--project", join(consumerDir, config)],
    {
      cwd: consumerDir,
      stdio: "inherit",
    },
  );
}

writeFileSync(
  join(consumerDir, "consumer.mjs"),
  `import assert from 'node:assert/strict'\nimport { redirects } from ${JSON.stringify(packageJson.name)}\n\nconst config = await redirects()({ collections: [] })\nassert.ok(config.collections?.some(({ slug }) => slug === 'redirects'))\n`,
);
execFileSync(process.execPath, [join(consumerDir, "consumer.mjs")], {
  cwd: consumerDir,
  stdio: "inherit",
});

if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `consumer-dir=${consumerDir}\n`, { flag: "a" });
}
console.log(`Verified ${packageJson.name}@${packageJson.version} tarball and isolated consumer.`);
