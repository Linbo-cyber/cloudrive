import { Hono } from "hono";
import { cors } from "hono/cors";
import { SignJWT, jwtVerify } from "jose";

interface Env {
  R2: R2Bucket;
  KV: KVNamespace;
  JWT_SECRET?: string;
}

interface Permissions {
  upload: boolean;
  delete: boolean;
  createFolder: boolean;
  move: boolean;
  copy: boolean;
  rename: boolean;
  preview: boolean;
  download: boolean;
}

interface UserRecord {
  username: string;
  passwordHash: string;
  role: "admin" | "user";
  permissions: Permissions;
  createdAt: string;
}

interface SystemConfig {
  initialized: boolean;
  guestEnabled: boolean;
  guestPath: string;
}

const app = new Hono<{ Bindings: Env; Variables: { user?: UserRecord } }>();

app.use("*", cors());

// ── Helpers ──

function getSecret(env: Env): Uint8Array {
  const s = env.JWT_SECRET || "cloudrive-default-secret-change-me";
  return new TextEncoder().encode(s);
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createToken(env: Env, username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret(env));
}

async function verifyToken(env: Env, token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(env));
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

async function getConfig(kv: KVNamespace): Promise<SystemConfig> {
  const raw = await kv.get("system:config");
  if (!raw) return { initialized: false, guestEnabled: true, guestPath: "" };
  const parsed = JSON.parse(raw);
  return { guestPath: "", ...parsed };
}

async function setConfig(kv: KVNamespace, config: SystemConfig) {
  await kv.put("system:config", JSON.stringify(config));
}

async function getUser(kv: KVNamespace, username: string): Promise<UserRecord | null> {
  const raw = await kv.get(`user:${username}`);
  return raw ? JSON.parse(raw) : null;
}

async function setUser(kv: KVNamespace, user: UserRecord) {
  await kv.put(`user:${user.username}`, JSON.stringify(user));
  const list = await getUserList(kv);
  if (!list.includes(user.username)) {
    list.push(user.username);
    await kv.put("system:users", JSON.stringify(list));
  }
}

async function deleteUserRecord(kv: KVNamespace, username: string) {
  await kv.delete(`user:${username}`);
  const list = await getUserList(kv);
  await kv.put("system:users", JSON.stringify(list.filter((u) => u !== username)));
}

async function getUserList(kv: KVNamespace): Promise<string[]> {
  const raw = await kv.get("system:users");
  return raw ? JSON.parse(raw) : [];
}

function isGuestAllowed(config: SystemConfig, prefix: string): boolean {
  if (!config.guestEnabled) return false;
  if (!config.guestPath) return true; // no restriction
  const allowed = config.guestPath.endsWith("/") ? config.guestPath : config.guestPath + "/";
  return prefix === "" || prefix === allowed || prefix.startsWith(allowed);
}

// ── Auth middleware ──

async function authMiddleware(c: any, next: () => Promise<void>) {
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const username = await verifyToken(c.env, token);
    if (username) {
      const user = await getUser(c.env.KV, username);
      if (user) c.set("user", user);
    }
  }
  await next();
}

function requireAuth(c: any): UserRecord {
  const user = c.get("user");
  if (!user) throw new Error("Unauthorized");
  return user;
}

function requireAdmin(c: any): UserRecord {
  const user = requireAuth(c);
  if (user.role !== "admin") throw new Error("Forbidden");
  return user;
}

app.use("/api/*", authMiddleware);

// ── Auth routes ──

app.get("/api/auth/status", async (c) => {
  const config = await getConfig(c.env.KV);
  return c.json({
    initialized: config.initialized,
    guestEnabled: config.guestEnabled,
    guestPath: config.guestPath,
  });
});

app.post("/api/auth/setup", async (c) => {
  const config = await getConfig(c.env.KV);
  if (config.initialized) return c.json({ error: "Already initialized" }, 400);

  const { username, password } = await c.req.json();
  if (!username || !password) return c.json({ error: "Missing fields" }, 400);
  if (password.length < 6) return c.json({ error: "Password too short" }, 400);

  const user: UserRecord = {
    username,
    passwordHash: await hashPassword(password),
    role: "admin",
    permissions: {
      upload: true, delete: true, createFolder: true,
      move: true, copy: true, rename: true, preview: true, download: true,
    },
    createdAt: new Date().toISOString(),
  };

  await setUser(c.env.KV, user);
  await setConfig(c.env.KV, { initialized: true, guestEnabled: true, guestPath: "" });

  const token = await createToken(c.env, username);
  const { passwordHash: _, ...safeUser } = user;
  return c.json({ token, user: safeUser });
});

app.post("/api/auth/login", async (c) => {
  const { username, password } = await c.req.json();
  if (!username || !password) return c.json({ error: "Missing fields" }, 400);

  const user = await getUser(c.env.KV, username);
  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) return c.json({ error: "Invalid credentials" }, 401);

  const token = await createToken(c.env, username);
  const { passwordHash: _, ...safeUser } = user;
  return c.json({ token, user: safeUser });
});

app.get("/api/auth/me", async (c) => {
  try {
    const user = requireAuth(c);
    const { passwordHash: _, ...safeUser } = user;
    return c.json({ user: safeUser });
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
});

// ── File routes ──

app.get("/api/files", async (c) => {
  const config = await getConfig(c.env.KV);
  const user = c.get("user");
  const prefix = c.req.query("prefix") || "";

  if (!user) {
    if (!isGuestAllowed(config, prefix)) return c.json({ error: "Unauthorized" }, 401);
  }

  const listed = await c.env.R2.list({ prefix, delimiter: "/" });
  const files: any[] = [];

  for (const p of listed.delimitedPrefixes) {
    const name = p.slice(prefix.length).replace(/\/$/, "");
    if (name) {
      files.push({ key: p, name, size: 0, isFolder: true });
    }
  }

  for (const obj of listed.objects) {
    const name = obj.key.slice(prefix.length);
    if (!name || name.endsWith("/") || name.endsWith(".cloudrive-folder")) continue;
    files.push({
      key: obj.key,
      name,
      size: obj.size,
      isFolder: false,
      lastModified: obj.uploaded?.toISOString(),
      contentType: obj.httpMetadata?.contentType,
    });
  }

  files.sort((a: any, b: any) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return c.json({ files, path: prefix });
});

app.post("/api/files/upload", async (c) => {
  const user = c.get("user");
  if (!user || (user.role !== "admin" && !user.permissions.upload)) {
    return c.json({ error: "No permission" }, 403);
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const path = formData.get("path") as string || "";

  if (!file) return c.json({ error: "No file" }, 400);

  const key = path.endsWith("/") || path === "" ? path + file.name : path;
  await c.env.R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  return c.json({ key });
});

app.post("/api/files/folder", async (c) => {
  const user = c.get("user");
  if (!user || (user.role !== "admin" && !user.permissions.createFolder)) {
    return c.json({ error: "No permission" }, 403);
  }

  const { path } = await c.req.json();
  if (!path) return c.json({ error: "Missing path" }, 400);

  const key = path.endsWith("/") ? path : path + "/";
  await c.env.R2.put(key + ".cloudrive-folder", new Uint8Array(0));

  return c.json({ key });
});

app.post("/api/files/delete", async (c) => {
  const user = c.get("user");
  if (!user || (user.role !== "admin" && !user.permissions.delete)) {
    return c.json({ error: "No permission" }, 403);
  }

  const { key } = await c.req.json();
  if (!key) return c.json({ error: "Missing key" }, 400);

  if (key.endsWith("/")) {
    let cursor: string | undefined;
    do {
      const listed = await c.env.R2.list({ prefix: key, cursor });
      if (listed.objects.length > 0) {
        await c.env.R2.delete(listed.objects.map((o: any) => o.key));
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  } else {
    await c.env.R2.delete(key);
  }

  return c.json({ ok: true });
});

app.post("/api/files/delete-batch", async (c) => {
  const user = c.get("user");
  if (!user || (user.role !== "admin" && !user.permissions.delete)) {
    return c.json({ error: "No permission" }, 403);
  }

  const { keys } = await c.req.json();
  if (!Array.isArray(keys)) return c.json({ error: "Missing keys" }, 400);

  for (const key of keys) {
    if (key.endsWith("/")) {
      let cursor: string | undefined;
      do {
        const listed = await c.env.R2.list({ prefix: key, cursor });
        if (listed.objects.length > 0) {
          await c.env.R2.delete(listed.objects.map((o: any) => o.key));
        }
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);
    } else {
      await c.env.R2.delete(key);
    }
  }

  return c.json({ ok: true });
});

app.post("/api/files/rename", async (c) => {
  const user = c.get("user");
  if (!user || (user.role !== "admin" && !user.permissions.rename)) {
    return c.json({ error: "No permission" }, 403);
  }

  const { oldKey, newKey } = await c.req.json();
  if (!oldKey || !newKey) return c.json({ error: "Missing keys" }, 400);

  if (oldKey.endsWith("/")) {
    let cursor: string | undefined;
    do {
      const listed = await c.env.R2.list({ prefix: oldKey, cursor });
      for (const obj of listed.objects) {
        const newObjKey = newKey + obj.key.slice(oldKey.length);
        const data = await c.env.R2.get(obj.key);
        if (data) {
          await c.env.R2.put(newObjKey, data.body, { httpMetadata: data.httpMetadata });
          await c.env.R2.delete(obj.key);
        }
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  } else {
    const obj = await c.env.R2.get(oldKey);
    if (!obj) return c.json({ error: "File not found" }, 404);
    await c.env.R2.put(newKey, obj.body, { httpMetadata: obj.httpMetadata });
    await c.env.R2.delete(oldKey);
  }

  return c.json({ ok: true });
});

app.post("/api/files/move", async (c) => {
  const user = c.get("user");
  if (!user || (user.role !== "admin" && !user.permissions.move)) {
    return c.json({ error: "No permission" }, 403);
  }

  const { key, dest } = await c.req.json();
  if (!key) return c.json({ error: "Missing key" }, 400);

  const name = key.split("/").filter(Boolean).pop() || key;
  const destPath = dest ? (dest.endsWith("/") ? dest : dest + "/") : "";
  const newKey = destPath + name + (key.endsWith("/") ? "/" : "");

  if (key.endsWith("/")) {
    let cursor: string | undefined;
    do {
      const listed = await c.env.R2.list({ prefix: key, cursor });
      for (const obj of listed.objects) {
        const suffix = obj.key.slice(key.length);
        const newObjKey = newKey + suffix;
        const data = await c.env.R2.get(obj.key);
        if (data) {
          await c.env.R2.put(newObjKey, data.body, { httpMetadata: data.httpMetadata });
          await c.env.R2.delete(obj.key);
        }
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  } else {
    const obj = await c.env.R2.get(key);
    if (!obj) return c.json({ error: "File not found" }, 404);
    await c.env.R2.put(destPath + name, obj.body, { httpMetadata: obj.httpMetadata });
    await c.env.R2.delete(key);
  }

  return c.json({ ok: true });
});

app.post("/api/files/copy", async (c) => {
  const user = c.get("user");
  if (!user || (user.role !== "admin" && !user.permissions.copy)) {
    return c.json({ error: "No permission" }, 403);
  }

  const { key, dest } = await c.req.json();
  if (!key) return c.json({ error: "Missing key" }, 400);

  const name = key.split("/").filter(Boolean).pop() || key;
  const destPath = dest ? (dest.endsWith("/") ? dest : dest + "/") : "";

  const obj = await c.env.R2.get(key);
  if (!obj) return c.json({ error: "File not found" }, 404);
  await c.env.R2.put(destPath + name, obj.body, { httpMetadata: obj.httpMetadata });

  return c.json({ ok: true });
});

app.get("/api/files/download", async (c) => {
  const config = await getConfig(c.env.KV);
  const user = c.get("user");
  const key = c.req.query("key");
  if (!key) return c.json({ error: "Missing key" }, 400);

  if (!user) {
    if (!isGuestAllowed(config, key)) return c.json({ error: "Unauthorized" }, 401);
  } else if (user.role !== "admin" && !user.permissions.download) {
    return c.json({ error: "No permission" }, 403);
  }

  const obj = await c.env.R2.get(key);
  if (!obj) return c.json({ error: "Not found" }, 404);

  const name = key.split("/").pop() || "download";
  const headers = new Headers();
  headers.set("Content-Type", "application/octet-stream");
  headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
  headers.set("Content-Length", obj.size.toString());

  return new Response(obj.body, { headers });
});

app.get("/api/files/preview", async (c) => {
  const config = await getConfig(c.env.KV);
  const user = c.get("user");
  const key = c.req.query("key");
  if (!key) return c.json({ error: "Missing key" }, 400);

  if (!user) {
    if (!isGuestAllowed(config, key)) return c.json({ error: "Unauthorized" }, 401);
  } else if (user.role !== "admin" && !user.permissions.preview) {
    return c.json({ error: "No permission" }, 403);
  }

  const obj = await c.env.R2.get(key);
  if (!obj) return c.json({ error: "Not found" }, 404);

  const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Length", obj.size.toString());
  headers.set("Cache-Control", "public, max-age=3600");

  return new Response(obj.body, { headers });
});

// ── Admin routes ──

app.get("/api/admin/users", async (c) => {
  try { requireAdmin(c); } catch { return c.json({ error: "Forbidden" }, 403); }

  const list = await getUserList(c.env.KV);
  const users = [];
  for (const username of list) {
    const user = await getUser(c.env.KV, username);
    if (user) {
      const { passwordHash: _, ...safe } = user;
      users.push(safe);
    }
  }
  return c.json({ users });
});

app.post("/api/admin/users", async (c) => {
  try { requireAdmin(c); } catch { return c.json({ error: "Forbidden" }, 403); }

  const { username, password, permissions } = await c.req.json();
  if (!username || !password) return c.json({ error: "Missing fields" }, 400);
  if (password.length < 6) return c.json({ error: "Password too short" }, 400);

  const existing = await getUser(c.env.KV, username);
  if (existing) return c.json({ error: "User already exists" }, 400);

  const user: UserRecord = {
    username,
    passwordHash: await hashPassword(password),
    role: "user",
    permissions: permissions || {
      upload: true, download: true, preview: true, delete: false,
      createFolder: true, move: true, copy: true, rename: true,
    },
    createdAt: new Date().toISOString(),
  };

  await setUser(c.env.KV, user);
  const { passwordHash: _, ...safe } = user;
  return c.json({ user: safe });
});

app.put("/api/admin/users/:username", async (c) => {
  try { requireAdmin(c); } catch { return c.json({ error: "Forbidden" }, 403); }

  const username = c.req.param("username");
  const user = await getUser(c.env.KV, username);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.role === "admin") return c.json({ error: "Cannot modify admin" }, 400);

  const { password, permissions } = await c.req.json();
  if (password) {
    if (password.length < 6) return c.json({ error: "Password too short" }, 400);
    user.passwordHash = await hashPassword(password);
  }
  if (permissions) user.permissions = permissions;

  await setUser(c.env.KV, user);
  const { passwordHash: _, ...safe } = user;
  return c.json({ user: safe });
});

app.delete("/api/admin/users/:username", async (c) => {
  try { requireAdmin(c); } catch { return c.json({ error: "Forbidden" }, 403); }

  const username = c.req.param("username");
  const user = await getUser(c.env.KV, username);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.role === "admin") return c.json({ error: "Cannot delete admin" }, 400);

  await deleteUserRecord(c.env.KV, username);
  return c.json({ ok: true });
});

app.get("/api/admin/guest", async (c) => {
  try { requireAdmin(c); } catch { return c.json({ error: "Forbidden" }, 403); }
  const config = await getConfig(c.env.KV);
  return c.json({ enabled: config.guestEnabled, path: config.guestPath });
});

app.put("/api/admin/guest", async (c) => {
  try { requireAdmin(c); } catch { return c.json({ error: "Forbidden" }, 403); }
  const { enabled, path } = await c.req.json();
  const config = await getConfig(c.env.KV);
  if (typeof enabled === "boolean") config.guestEnabled = enabled;
  if (typeof path === "string") config.guestPath = path;
  await setConfig(c.env.KV, config);
  return c.json({ ok: true });
});

// ── Export for Cloudflare Pages Functions ──

export function onRequest(context: { request: Request; env: Env; params: { path: string[] } }) {
  return app.fetch(context.request, context.env);
}
