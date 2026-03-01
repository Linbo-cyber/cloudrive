export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return d.toLocaleDateString("zh-CN");
}

export function getFileIcon(name: string, isFolder: boolean): string {
  if (isFolder) return "folder";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", svg: "image", bmp: "image", ico: "image",
    mp4: "video", mkv: "video", avi: "video", mov: "video", webm: "video",
    mp3: "audio", wav: "audio", flac: "audio", ogg: "audio", aac: "audio",
    pdf: "pdf",
    doc: "doc", docx: "doc",
    xls: "sheet", xlsx: "sheet", csv: "sheet",
    ppt: "ppt", pptx: "ppt",
    zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
    js: "code", ts: "code", jsx: "code", tsx: "code", py: "code", go: "code", rs: "code", c: "code", cpp: "code", h: "code", java: "code", rb: "code", php: "code", sh: "code", css: "code", html: "code", json: "code", xml: "code", yaml: "code", yml: "code", toml: "code", md: "code",
    txt: "text", log: "text",
    exe: "binary", dll: "binary", so: "binary",
  };
  return map[ext] || "file";
}

export function isPreviewable(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const previewable = new Set([
    "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp",
    "mp4", "webm", "ogg",
    "mp3", "wav", "flac", "aac", "ogg",
    "pdf",
    "txt", "md", "json", "js", "ts", "jsx", "tsx", "py", "go", "rs", "c", "cpp", "h",
    "java", "rb", "php", "sh", "css", "html", "xml", "yaml", "yml", "toml", "log",
    "csv",
  ]);
  return previewable.has(ext);
}

export function getPreviewType(name: string): "image" | "video" | "audio" | "pdf" | "text" | null {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (["mp4", "webm"].includes(ext)) return "video";
  if (["mp3", "wav", "flac", "aac", "ogg"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (["txt", "md", "json", "js", "ts", "jsx", "tsx", "py", "go", "rs", "c", "cpp", "h", "java", "rb", "php", "sh", "css", "html", "xml", "yaml", "yml", "toml", "log", "csv"].includes(ext)) return "text";
  return null;
}
