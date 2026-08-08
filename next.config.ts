import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

// mssql's driver (tedious) uses dynamic requires that Next's file tracing
// can't follow statically, so its whole dependency closure gets dropped from
// the standalone build unless force-included here. We walk the closure at
// build time instead of hardcoding it, so it stays correct across upgrades.
function mssqlDependencyClosure(): string[] {
  const seen = new Set<string>();
  const walk = (pkgName: string) => {
    if (seen.has(pkgName)) return;
    seen.add(pkgName);
    const pkgJsonPath = path.join(process.cwd(), "node_modules", pkgName, "package.json");
    if (!fs.existsSync(pkgJsonPath)) return;
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.optionalDependencies };
    for (const dep of Object.keys(deps || {})) walk(dep);
  };
  walk("mssql");
  return [...seen].map((name) => `./node_modules/${name}/**/*`);
}

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": mssqlDependencyClosure(),
  },
};

export default nextConfig;
