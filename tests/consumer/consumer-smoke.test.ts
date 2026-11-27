import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  closeTestPostgresPool,
  createIsolatedDatabase,
  dropIsolatedDatabase,
} from "../helpers/test-postgres";

/**
 * Consumer smoke test. It packs this repository, installs the tarball into a throwaway Next.js 16 app
 * with Payload 3.94.1 and PostgreSQL, builds and serves that app, and asserts real HTTP responses.
 * The fixture lives in a temporary directory and is removed afterwards; nothing is added to the repo.
 */

const NEXT_VERSION = "16.4.6";
const PAYLOAD_VERSION = "3.94.1";
const databaseUrl = process.env.PAYLOAD_REDIRECT_TEST_DATABASE_URL?.trim();
const enabled = Boolean(databaseUrl);
const REPO = path.resolve(import.meta.dir, "../..");

const FILES: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "redirect-consumer-smoke",
      private: true,
      type: "module",
      scripts: { build: "next build", start: "next start" },
    },
    null,
    2,
  ),
  "tsconfig.json": JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "es2022"],
        module: "esnext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        skipLibCheck: true,
        isolatedModules: true,
        incremental: false,
        paths: { "@payload-config": ["./src/payload.config.ts"] },
      },
      include: ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
    null,
    2,
  ),
  "next.config.mjs": "export default { serverExternalPackages: ['pg'] };\n",
  "src/payload.config.ts": `import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig, type CollectionConfig, type GlobalConfig } from "payload";
import { redirects } from "@klnap/payload-redirect";

const localization = { locales: ["en", "fr", "de"], defaultLocale: "en" };

const Users: CollectionConfig = { slug: "users", auth: true, fields: [] };

const Articles: CollectionConfig = {
  slug: "articles",
  versions: { drafts: true },
  admin: { useAsTitle: "title" },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true, localized: true },
  ],
  custom: {
    redirect: {
      paths: { en: "/articles/[slug]", fr: "/articles/[slug]", de: "/artikel/[slug]" },
    },
  },
};

const About: GlobalConfig = {
  slug: "about",
  versions: { drafts: true },
  fields: [
    { name: "title", type: "text" },
    { name: "slug", type: "text", required: true },
  ],
  custom: { redirect: { path: "/[slug]" } },
};

export default buildConfig({
  secret: "consumer-smoke-secret-consumer-smoke-secret",
  localization,
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL! },
    push: true,
  }),
  collections: [Users, Articles],
  globals: [About],
  plugins: [
    redirects({ localePrefixes: { en: "", fr: "/fr", de: "/de" } }),
  ],
});
`,
  "src/proxy.ts": `import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import payloadConfig from "@payload-config";

function normalizeRequestPath(pathname: string): string {
  const collapsed = pathname.replace(/\\/{2,}/g, "/");
  return collapsed.length > 1 && collapsed.endsWith("/") ? collapsed.slice(0, -1) : collapsed;
}

export async function proxy(request: NextRequest) {
  const { search } = request.nextUrl;
  const from = normalizeRequestPath(request.nextUrl.pathname) + search;

  const payload = await getPayload({ config: payloadConfig });
  const { docs } = await payload.find({
    collection: "redirects",
    where: {
      and: [{ from: { equals: from } }, { enabled: { equals: true } }],
    },
    limit: 1,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });

  const rule = docs[0];
  if (!rule) return NextResponse.next();

  const target = new URL(rule.to, request.url);
  if (target.pathname + target.search === from) return NextResponse.next();

  return NextResponse.redirect(target, Number(rule.statusCode) as 301 | 302);
}

export const config = {
  matcher: ["/((?!api|admin|_next/static|_next/image|favicon.ico).*)"],
};
`,
  "src/app/layout.tsx": `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
  "src/app/[...slug]/page.tsx": `export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <h1>Landing {slug.join("/")}</h1>;
}
`,
  "src/app/page.tsx": "export default function Home() {\n  return <h1>Home</h1>;\n}\n",
  "scripts/seed.ts": `import { getPayload } from "payload";
import config from "../src/payload.config";

const payload = await getPayload({ config });

const article = await payload.create({
  collection: "articles",
  data: { title: "Hello", slug: "hello-world", _status: "published" },
  draft: false,
  overrideAccess: true,
});
// French gets its own published slug first, then changes it: that change produces the localized rule.
await payload.update({
  collection: "articles",
  id: article.id,
  data: { slug: "premiers-pas", _status: "published" },
  locale: "fr",
  draft: false,
  overrideAccess: true,
});
await payload.update({
  collection: "articles",
  id: article.id,
  data: { slug: "introduction-to-payload", _status: "published" },
  locale: "en",
  draft: false,
  overrideAccess: true,
});
await payload.update({
  collection: "articles",
  id: article.id,
  data: { slug: "bien-demarrer", _status: "published" },
  locale: "fr",
  draft: false,
  overrideAccess: true,
});

await payload.updateGlobal({
  slug: "about",
  data: { title: "About", slug: "about", _status: "published" },
  draft: false,
  overrideAccess: true,
});
await payload.updateGlobal({
  slug: "about",
  data: { title: "About us", slug: "about-us", _status: "published" },
  draft: false,
  overrideAccess: true,
});

const manual = [
  { from: "/summer-2027", to: "/summer-2027?utm_source=sms&utm_medium=sms&utm_campaign=summer_2027", statusCode: "302" },
  { from: "/campaign?ref=sms", to: "/offers?utm_source=sms", statusCode: "302" },
  { from: "/old-page", to: "/new-page?ref=legacy", statusCode: "301" },
  { from: "/old-guide", to: "/guides/getting-started#installation", statusCode: "301" },
  { from: "/promo?src=a", to: "/promo", statusCode: "301" },
  { from: "/ref?x=1", to: "/ref?x=2", statusCode: "301" },
  { from: "/caf%C3%A9", to: "/menu", statusCode: "301" },
  { from: "/summer-sale", to: "/offers", statusCode: "302", enabled: false },
];
for (const rule of manual) {
  await payload.create({ collection: "redirects", data: rule as never, overrideAccess: true });
}
process.exit(0);
`,
};

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });

const run = (command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) =>
  execFileSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    timeout: 600_000,
  });

describe.skipIf(!enabled)(
  "consumer smoke: packed package in Next.js 16 with Payload and PostgreSQL",
  () => {
    let root = "";
    let base = "";
    let server: ChildProcess | undefined;
    let database: { url: string; database: string } | undefined;
    const baseUrl = databaseUrl ?? "";

    const get = (pathAndQuery: string) => fetch(`${base}${pathAndQuery}`, { redirect: "manual" });

    beforeAll(async () => {
      run("bun", ["run", "build"], REPO);
      const packDir = mkdtempSync(path.join(tmpdir(), "redirect-pack-"));
      const tarball = run("npm", ["pack", "--pack-destination", packDir], REPO)
        .trim()
        .split("\n")
        .pop()!;
      const tarballPath = path.join(packDir, tarball);

      root = mkdtempSync(path.join(tmpdir(), "redirect-consumer-"));
      for (const [file, content] of Object.entries(FILES)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
      }
      const pkg = JSON.parse(FILES["package.json"]!) as Record<string, unknown>;
      pkg.dependencies = {
        next: NEXT_VERSION,
        react: "19",
        "react-dom": "19",
        payload: PAYLOAD_VERSION,
        "@payloadcms/db-postgres": PAYLOAD_VERSION,
        "@payloadcms/richtext-lexical": PAYLOAD_VERSION,
        "@klnap/payload-redirect": `file:${tarballPath}`,
      };
      pkg.devDependencies = { typescript: "^5", "@types/react": "^19", "@types/node": "^22" };
      writeFileSync(path.join(root, "package.json"), JSON.stringify(pkg, null, 2));
      run("npm", ["install", "--no-audit", "--no-fund"], root);
      rmSync(packDir, { recursive: true, force: true });

      database = await createIsolatedDatabase(baseUrl, "redirect");
      const env = { DATABASE_URL: database.url };
      run("npx", ["next", "build"], root, env);
      run("bun", ["scripts/seed.ts"], root, env);

      const port = await freePort();
      base = `http://127.0.0.1:${port}`;
      server = spawn("npx", ["next", "start", "-p", String(port)], {
        cwd: root,
        env: { ...process.env, ...env },
        stdio: "ignore",
      });
      for (let attempt = 0; attempt < 120; attempt++) {
        try {
          const response = await get("/");
          if (response.status === 200) return;
        } catch {
          // The server is still starting.
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error("Next.js server did not start");
    }, 900_000);

    afterAll(async () => {
      server?.kill("SIGTERM");
      if (root) rmSync(root, { recursive: true, force: true });
      if (database) {
        await dropIsolatedDatabase(baseUrl, database.database).catch(() => undefined);
      }
    });

    const expectRedirect = async (from: string, status: number, location: string) => {
      const response = await get(from);
      expect(response.status).toBe(status);
      const target = new URL(response.headers.get("location") ?? "", base);
      expect(target.pathname + target.search + target.hash).toBe(location);
    };

    it("serves automatic article-slug redirects with 301", async () => {
      await expectRedirect("/articles/hello-world", 301, "/articles/introduction-to-payload");
    });

    it("serves automatic Global redirects with 301", async () => {
      await expectRedirect("/about", 301, "/about-us");
    });

    it("serves localized automatic redirects for the French article", async () => {
      await expectRedirect("/fr/articles/premiers-pas", 301, "/fr/articles/bien-demarrer");
    });

    it("serves manual 301 and 302 rules, including destination fragments", async () => {
      await expectRedirect("/old-page", 301, "/new-page?ref=legacy");
      await expectRedirect("/old-guide", 301, "/guides/getting-started#installation");
      await expectRedirect("/ref?x=1", 301, "/ref?x=2");
      await expectRedirect("/promo?src=a", 301, "/promo");
    });

    it("passes disabled and missing rules through to the application", async () => {
      expect((await get("/summer-sale")).status).toBe(200);
      expect((await get("/no-such-rule")).status).toBe(200);
    });

    it("matches query-specific sources exactly", async () => {
      await expectRedirect("/campaign?ref=sms", 302, "/offers?utm_source=sms");
      expect((await get("/campaign")).status).toBe(200);
      expect((await get("/campaign?ref=email")).status).toBe(200);
    });

    it("matches Unicode and percent-encoded sources through the browser-encoded form", async () => {
      await expectRedirect("/caf%C3%A9", 301, "/menu");
      await expectRedirect("/café", 301, "/menu");
    });

    it("runs the SMS campaign flow: 302 to the landing URL, then 200 with no further redirect", async () => {
      const first = await get("/summer-2027");
      expect(first.status).toBe(302);
      const location = first.headers.get("location") ?? "";
      expect(location).toBe("/summer-2027?utm_source=sms&utm_medium=sms&utm_campaign=summer_2027");

      const landing = await fetch(`${base}${location}`, { redirect: "manual" });
      expect(landing.status).toBe(200);
      // React writes a text-node comment between the static and dynamic parts of the heading.
      expect(await landing.text()).toMatch(/<h1>Landing <!-- -->summer-2027<\/h1>/);
    });
  },
);
