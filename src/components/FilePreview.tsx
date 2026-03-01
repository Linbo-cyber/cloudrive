import { useState, useEffect } from "react";
import { type FileItem, api } from "@/lib/api";
import { getPreviewType } from "@/lib/format";
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogPanel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DownloadIcon, XIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface Props {
  file: FileItem | null;
  open: boolean;
  onClose: () => void;
}

export default function FilePreview({ file, open, onClose }: Props) {
  const { can } = useAuth();
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file || !open) { setTextContent(null); return; }
    const type = getPreviewType(file.name);
    if (type === "text") {
      setLoading(true);
      fetch(api.getPreviewUrl(file.key))
        .then((r) => r.text())
        .then((t) => setTextContent(t))
        .catch(() => setTextContent("加载失败"))
        .finally(() => setLoading(false));
    }
  }, [file, open]);

  if (!file) return null;
  const type = getPreviewType(file.name);
  const previewUrl = api.getPreviewUrl(file.key);
  const downloadUrl = api.getDownloadUrl(file.key);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPopup className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-8">{file.name}</DialogTitle>
            {can("download") && (
              <a href={downloadUrl} download={file.name}>
                <Button size="icon-sm" variant="ghost"><DownloadIcon className="size-4" /></Button>
              </a>
            )}
          </div>
        </DialogHeader>
        <DialogPanel>
          <div className="flex items-center justify-center min-h-[200px]">
            {type === "image" && (
              <img src={previewUrl} alt={file.name} className="max-h-[70vh] max-w-full rounded-lg object-contain" />
            )}
            {type === "video" && (
              <video src={previewUrl} controls className="max-h-[70vh] max-w-full rounded-lg" />
            )}
            {type === "audio" && (
              <audio src={previewUrl} controls className="w-full" />
            )}
            {type === "pdf" && (
              <iframe src={previewUrl} className="h-[70vh] w-full rounded-lg border" />
            )}
            {type === "text" && (
              <pre className="w-full max-h-[70vh] overflow-auto rounded-lg bg-muted p-4 text-sm font-mono whitespace-pre-wrap break-words">
                {loading ? "加载中..." : textContent}
              </pre>
            )}
            {!type && (
              <p className="text-muted-foreground">此文件类型不支持预览</p>
            )}
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
