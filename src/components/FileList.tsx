import { useState } from "react";
import { type FileItem, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatSize, formatDate, getFileIcon, isPreviewable } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  FolderIcon, FileIcon, FileTextIcon, FileCodeIcon, ImageIcon, VideoIcon,
  MusicIcon, FileArchiveIcon, FileSpreadsheetIcon, PresentationIcon,
  MoreHorizontalIcon, DownloadIcon, EyeIcon, PencilIcon, TrashIcon,
  CopyIcon, MoveIcon, FileIcon as GenericFileIcon, LayoutGridIcon, ListIcon,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  folder: FolderIcon, image: ImageIcon, video: VideoIcon, audio: MusicIcon,
  pdf: FileTextIcon, doc: FileTextIcon, sheet: FileSpreadsheetIcon,
  ppt: PresentationIcon, archive: FileArchiveIcon, code: FileCodeIcon,
  text: FileTextIcon, binary: GenericFileIcon, file: FileIcon,
};

interface Props {
  files: FileItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onPreview: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onMove: (file: FileItem) => void;
  onCopy: (file: FileItem) => void;
  selectedFiles: Set<string>;
  onSelectFile: (key: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  viewMode: "list" | "grid";
  onViewModeChange: (mode: "list" | "grid") => void;
}

export default function FileList({
  files, currentPath, onNavigate, onRefresh, onPreview, onRename, onMove, onCopy,
  selectedFiles, onSelectFile, onSelectAll, viewMode, onViewModeChange,
}: Props) {
  const { can } = useAuth();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (file: FileItem) => {
    if (!confirm(`确定删除 ${file.name}？`)) return;
    setDeleting(file.key);
    try {
      await api.deleteFile(file.key);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (file: FileItem) => {
    const a = document.createElement("a");
    a.href = api.getDownloadUrl(file.key);
    a.download = file.name;
    a.click();
  };

  const handleClick = (file: FileItem) => {
    if (file.isFolder) {
      onNavigate(file.key);
    } else if (can("preview") && isPreviewable(file.name)) {
      onPreview(file);
    }
  };

  const allSelected = files.length > 0 && files.every((f) => selectedFiles.has(f.key));

  if (viewMode === "grid") {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            {files.length > 0 && (
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => onSelectAll(!!v)}
              />
            )}
            <span className="text-sm text-muted-foreground">{files.length} 项</span>
          </div>
          <div className="flex gap-1">
            <Button size="icon-sm" variant="ghost" onClick={() => onViewModeChange("list")}>
              <ListIcon className="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => onViewModeChange("grid")}>
              <LayoutGridIcon className="size-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {files.map((file) => {
            const iconType = getFileIcon(file.name, file.isFolder);
            const Icon = ICON_MAP[iconType] || FileIcon;
            const selected = selectedFiles.has(file.key);
            return (
              <div
                key={file.key}
                className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 transition-colors hover:bg-accent/50 ${selected ? "border-primary bg-accent/30" : "border-transparent"}`}
                onClick={() => handleClick(file)}
              >
                <div className="absolute left-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(v) => { onSelectFile(file.key, !!v); }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  />
                </div>
                <Icon className={`size-10 ${file.isFolder ? "text-blue-500" : "text-muted-foreground"}`} />
                <span className="w-full truncate text-center text-sm">{file.name}</span>
                {!file.isFolder && (
                  <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-1 px-1">
        <Button size="icon-sm" variant="ghost" onClick={() => onViewModeChange("list")}>
          <ListIcon className="size-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => onViewModeChange("grid")}>
          <LayoutGridIcon className="size-4" />
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => onSelectAll(!!v)}
              />
            </TableHead>
            <TableHead>名称</TableHead>
            <TableHead className="hidden sm:table-cell w-28">大小</TableHead>
            <TableHead className="hidden md:table-cell w-36">修改时间</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
            const iconType = getFileIcon(file.name, file.isFolder);
            const Icon = ICON_MAP[iconType] || FileIcon;
            const selected = selectedFiles.has(file.key);
            return (
              <TableRow key={file.key} className={selected ? "bg-accent/30" : ""}>
                <TableCell>
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(v) => onSelectFile(file.key, !!v)}
                  />
                </TableCell>
                <TableCell>
                  <button
                    className="flex items-center gap-2 hover:underline text-left"
                    onClick={() => handleClick(file)}
                  >
                    <Icon className={`size-4 shrink-0 ${file.isFolder ? "text-blue-500" : "text-muted-foreground"}`} />
                    <span className="truncate max-w-xs">{file.name}</span>
                  </button>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {file.isFolder ? "—" : formatSize(file.size)}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {file.lastModified ? formatDate(file.lastModified) : "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-xs" variant="ghost">
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!file.isFolder && can("preview") && isPreviewable(file.name) && (
                        <DropdownMenuItem onClick={() => onPreview(file)}>
                          <EyeIcon className="size-4" /> 预览
                        </DropdownMenuItem>
                      )}
                      {!file.isFolder && can("download") && (
                        <DropdownMenuItem onClick={() => handleDownload(file)}>
                          <DownloadIcon className="size-4" /> 下载
                        </DropdownMenuItem>
                      )}
                      {can("rename") && (
                        <DropdownMenuItem onClick={() => onRename(file)}>
                          <PencilIcon className="size-4" /> 重命名
                        </DropdownMenuItem>
                      )}
                      {can("copy") && !file.isFolder && (
                        <DropdownMenuItem onClick={() => onCopy(file)}>
                          <CopyIcon className="size-4" /> 复制
                        </DropdownMenuItem>
                      )}
                      {can("move") && (
                        <DropdownMenuItem onClick={() => onMove(file)}>
                          <MoveIcon className="size-4" /> 移动
                        </DropdownMenuItem>
                      )}
                      {can("delete") && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(file)}
                            disabled={deleting === file.key}
                          >
                            <TrashIcon className="size-4" /> 删除
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
