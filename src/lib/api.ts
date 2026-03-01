const API_BASE = "/api";

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    ...opts.headers,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body:
      opts.body instanceof FormData
        ? opts.body
        : opts.body
          ? JSON.stringify(opts.body)
          : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export interface FileItem {
  key: string;
  name: string;
  size: number;
  isFolder: boolean;
  lastModified?: string;
  contentType?: string;
}

export interface User {
  username: string;
  role: "admin" | "user";
  permissions: Permissions;
  createdAt: string;
}

export interface Permissions {
  upload: boolean;
  delete: boolean;
  createFolder: boolean;
  move: boolean;
  copy: boolean;
  rename: boolean;
  preview: boolean;
  download: boolean;
}

export interface SystemConfig {
  initialized: boolean;
  guestEnabled: boolean;
}

export const api = {
  // Auth
  getStatus: () => request<SystemConfig>("/auth/status"),
  setup: (username: string, password: string) =>
    request<{ token: string; user: User }>("/auth/setup", {
      method: "POST",
      body: { username, password },
    }),
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { username, password },
    }),
  me: () => request<{ user: User }>("/auth/me"),

  // Files
  listFiles: (prefix: string = "") =>
    request<{ files: FileItem[]; path: string }>(`/files?prefix=${encodeURIComponent(prefix)}`),
  upload: (path: string, file: File, onProgress?: (pct: number) => void) => {
    return new Promise<{ key: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/files/upload`);
      const token = localStorage.getItem("token");
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            reject(new Error(JSON.parse(xhr.responseText).error));
          } catch {
            reject(new Error("Upload failed"));
          }
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("path", path);
      xhr.send(fd);
    });
  },
  createFolder: (path: string) =>
    request<{ key: string }>("/files/folder", { method: "POST", body: { path } }),
  deleteFile: (key: string) =>
    request<{ ok: boolean }>("/files/delete", { method: "POST", body: { key } }),
  deleteFiles: (keys: string[]) =>
    request<{ ok: boolean }>("/files/delete-batch", { method: "POST", body: { keys } }),
  renameFile: (oldKey: string, newKey: string) =>
    request<{ ok: boolean }>("/files/rename", { method: "POST", body: { oldKey, newKey } }),
  moveFile: (key: string, dest: string) =>
    request<{ ok: boolean }>("/files/move", { method: "POST", body: { key, dest } }),
  copyFile: (key: string, dest: string) =>
    request<{ ok: boolean }>("/files/copy", { method: "POST", body: { key, dest } }),
  getDownloadUrl: (key: string) => `${API_BASE}/files/download?key=${encodeURIComponent(key)}`,
  getPreviewUrl: (key: string) => `${API_BASE}/files/preview?key=${encodeURIComponent(key)}`,

  // Admin
  listUsers: () => request<{ users: User[] }>("/admin/users"),
  createUser: (username: string, password: string, permissions: Permissions) =>
    request<{ user: User }>("/admin/users", {
      method: "POST",
      body: { username, password, permissions },
    }),
  updateUser: (username: string, data: { password?: string; permissions?: Permissions }) =>
    request<{ user: User }>(`/admin/users/${username}`, { method: "PUT", body: data }),
  deleteUser: (username: string) =>
    request<{ ok: boolean }>(`/admin/users/${username}`, { method: "DELETE" }),
  getGuestConfig: () => request<{ enabled: boolean }>("/admin/guest"),
  setGuestConfig: (enabled: boolean) =>
    request<{ ok: boolean }>("/admin/guest", { method: "PUT", body: { enabled } }),
};
