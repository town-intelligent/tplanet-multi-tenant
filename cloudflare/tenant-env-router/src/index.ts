type Env = {
  TENANT_ENV: KVNamespace;
  BINDING_TOKEN?: string;

  BASE_DOMAIN?: string;
  DEFAULT_ENV?: string;
  DEV_ORIGIN_HOST?: string;
  STABLE_ORIGIN_HOST?: string;
  AUTO_DETECT_MISSING_BINDING?: string;
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

function isTruthy(v: string | undefined): boolean {
  const s = (v || "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on";
}

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)\s*$/i);
  return m ? m[1] : null;
}

function extractTenantId(hostname: string, baseDomain: string): string | null {
  const host = hostname.toLowerCase();
  const suffix = `.${baseDomain.toLowerCase()}`;
  if (host === baseDomain.toLowerCase()) return "default";
  if (!host.endsWith(suffix)) return null;
  const left = host.slice(0, -suffix.length);
  // We only support one-level subdomains: {tenantId}.sechome.cc
  if (!left || left.includes(".")) return null;
  return left;
}

async function detectEnv(tenantId: string, devHost: string, stableHost: string): Promise<"dev" | "stable" | null> {
  const devUrl = `https://${devHost}/api/tenant/${encodeURIComponent(tenantId)}`;
  const stableUrl = `https://${stableHost}/api/tenant/${encodeURIComponent(tenantId)}`;

  const [devRes, stableRes] = await Promise.all([
    fetch(devUrl, { method: "GET" }),
    fetch(stableUrl, { method: "GET" }),
  ]);

  const devOk = devRes.ok;
  const stableOk = stableRes.ok;

  if (devOk && !stableOk) return "dev";
  if (!devOk && stableOk) return "stable";
  return null; // ambiguous (both ok or both not ok)
}

async function handleBindingApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["__binding", "{tenantId}"]
  const tenantId = parts[1] || "";

  const token = getBearerToken(request);
  if (!env.BINDING_TOKEN || token !== env.BINDING_TOKEN) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  if (!tenantId) return jsonResponse({ error: "tenantId is required" }, { status: 400 });

  if (request.method === "GET") {
    const v = await env.TENANT_ENV.get(tenantId);
    return jsonResponse({ tenantId, env: v }, { status: 200 });
  }

  if (request.method === "PUT") {
    let body: any = null;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
    }
    const targetEnv = (body?.env || "").toString();
    if (targetEnv !== "dev" && targetEnv !== "stable") {
      return jsonResponse({ error: "env must be 'dev' or 'stable'" }, { status: 400 });
    }
    await env.TENANT_ENV.put(tenantId, targetEnv);
    return jsonResponse({ ok: true, tenantId, env: targetEnv }, { status: 200 });
  }

  if (request.method === "DELETE") {
    await env.TENANT_ENV.delete(tenantId);
    return jsonResponse({ ok: true, tenantId, deleted: true }, { status: 200 });
  }

  return jsonResponse({ error: "Method not allowed" }, { status: 405 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/__binding/")) {
      return handleBindingApi(request, env);
    }

    const baseDomain = env.BASE_DOMAIN || "sechome.cc";
    const originalHost = url.hostname;
    const tenantId = extractTenantId(originalHost, baseDomain);
    if (!tenantId) {
      // Not our host; pass through.
      return fetch(request);
    }

    const devHost = env.DEV_ORIGIN_HOST || "dev.4impact.cc";
    const stableHost = env.STABLE_ORIGIN_HOST || "stable.4impact.cc";
    const defaultEnv = (env.DEFAULT_ENV || "stable") as "dev" | "stable";

    let targetEnv = (await env.TENANT_ENV.get(tenantId)) as "dev" | "stable" | null;

    // Optional: auto-detect if missing (helps migrate old tenants).
    if (!targetEnv && isTruthy(env.AUTO_DETECT_MISSING_BINDING)) {
      targetEnv = await detectEnv(tenantId, devHost, stableHost);
      if (targetEnv) {
        await env.TENANT_ENV.put(tenantId, targetEnv);
      }
    }

    if (!targetEnv) {
      targetEnv = defaultEnv;
    }

    // Route to a deterministic origin hostname so the origin proxy (nginx) can choose the correct stack.
    // Pass the original tenant hostname for backend tenant resolution.
    const originHost = targetEnv === "dev" ? devHost : stableHost;
    const originUrl = new URL(request.url);
    originUrl.hostname = originHost;

    const upstreamReq = new Request(originUrl.toString(), request);
    const upstreamHeaders = new Headers(upstreamReq.headers);
    upstreamHeaders.set("X-TPlanet-Original-Host", originalHost);
    upstreamHeaders.set("X-TPlanet-Env-Router", targetEnv);
    upstreamHeaders.set("X-TPlanet-Env-Router-Origin", originHost);
    const proxiedReq = new Request(upstreamReq, { headers: upstreamHeaders });

    const res = await fetch(proxiedReq);
    const out = new Response(res.body, res);
    out.headers.set("X-TPlanet-Env-Router", targetEnv);
    out.headers.set("X-TPlanet-Env-Router-Origin", originHost);
    out.headers.set("X-TPlanet-Env-Router-Tenant", tenantId);
    return out;
  },
};
