# Tenant Env Router Worker

This Cloudflare Worker makes `*.sechome.cc` deterministic by routing each tenant subdomain
to the correct origin environment (dev vs stable) using a KV mapping:

`tenantId -> env ("dev" | "stable")`

It also exposes a small binding API so the Django backend can write the mapping when a
tenant is created (and remove it when deleted).

## Worker Behavior

- Requests to `https://{tenantId}.sechome.cc/*`:
  - look up `{tenantId}` in KV
  - route to the configured origin hostname for that env (`dev.4impact.cc` / `stable.4impact.cc`)
  - include `X-TPlanet-Original-Host: {tenantId}.sechome.cc` so the backend can resolve the tenant
    deterministically even though the origin hostname is now `*.4impact.cc`.
- If the KV mapping is missing, the Worker can optionally auto-detect by checking
  which origin has `/api/tenant/{tenantId}`, then cache the result in KV.

## Binding API

- `PUT /__binding/{tenantId}` body: `{ "env": "dev" | "stable" }`
- `DELETE /__binding/{tenantId}`
- `GET /__binding/{tenantId}`

All require `Authorization: Bearer <token>`.

## Configure (wrangler)

1. Install dependencies:

```bash
cd cloudflare/tenant-env-router
npm i
```

2. Create KV namespace:

```bash
wrangler kv namespace create TENANT_ENV
wrangler kv namespace create TENANT_ENV --preview
```

3. Update `wrangler.toml` with the returned KV ids.

4. Set a secret token:

```bash
wrangler secret put BINDING_TOKEN
```

5. Configure routing variables (optional overrides):

- `BASE_DOMAIN` default: `sechome.cc`
- `DEFAULT_ENV` default: `stable`
- `DEV_ORIGIN_HOST` default: `dev.4impact.cc`
- `STABLE_ORIGIN_HOST` default: `stable.4impact.cc`
- `AUTO_DETECT_MISSING_BINDING` default: `true`

You can set these in `wrangler.toml` under `[vars]`.

6. Deploy and route:

```bash
wrangler deploy
```

Set Worker routes in Cloudflare:

- `*.sechome.cc/*`

## Django Backend Integration

In both dev and stable backends, tenant create/delete calls the binding API if these env vars exist:

- `TPLANET_ENV` = `dev` or `stable`
- `TENANT_ENV_ROUTER_BINDING_URL` = `https://<your-worker-domain>/__binding`
- `TENANT_ENV_ROUTER_BINDING_TOKEN` = your bearer token
- `TENANT_ENV_ROUTER_BINDING_REQUIRED` (optional) = `true` to fail hard on binding errors
