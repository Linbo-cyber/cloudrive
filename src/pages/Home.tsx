import { useState, useEffect, useCallback } from "react";
import { api, type FileItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import FileList from "@/components/FileList";
import FileUpload from "@/components/FileUpload";
import FilePreview from "@/components/FilePreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogPopup, DialogHeader, DialogTitle, DialogPanel, DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  CloudIcon, UploadIcon, FolderPlusIcon, TrashIcon, LogInIcon, LogOutIcon,
  SettingsIcon, ChevronRightIcon, HomeIcon, RefreshCwIcon, SearchIcon, XIcon,
  MoveIcon, CopyIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function HomePage() {
  const { user, can, logout, guestEnabled, initialized, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPath = searchParams.get("path") || "";
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "grid">(
    () => (localStorage.getItem("viewMode") as "list" | "grid") || "list"
  );
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [renameName, setRenameName] = useState("");
  const [moveFile, setMoveFile] = useState<FileItem | null>(null);
  const [moveDest, setMoveDest] = useState("");
  const [copyFile, setCopyFile] = useState<FileItem | null>(null);
  const [copyDest, setCopyDest] = useState("");
  const [search, setSearch] = useState("");

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listFiles(currentPath);
      setFiles(res.files);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
      setSelectedFiles(new Set());
    }
  }, [currentPath]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const navigateTo = (path: string) => {
    setSearchParams(path ? { path } : {});
  };

  const pathParts = currentPath.split("/").filter(Boolean);
  const breadcrumbs = pathParts.map((part, i) => ({
    name: part,
    path: pathParts.slice(0, i + 1).join("/") + "/",
  }));

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.createFolder(currentPath + newFolderName.trim() + "/");
      setShowNewFolder(false);
      setNewFolderName("");
      loadFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建失败");
    }
  };

  const handleRename = async () => {
    if (!renameFile || !renameName.trim()) return;
    const dir = renameFile.key.substring(0, renameFile.key.lastIndexOf("/") + 1);
    const newKey = dir + renameName.trim() + (renameFile.isFolder ? "/" : "");
    try {
      await api.renameFile(renameFile.key, newKey);
      setRenameFile(null);
      loadFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "重命名失败");
    }
  };

  const handleMove = async () => {
    if (!moveFile) return;
    try {
      await api.moveFile(moveFile.key, moveDest);
      setMoveFile(null);
      loadFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "移动失败");
    }
  };

  const handleCopy = async () => {
    if (!copyFile) return;
    try {
      await api.copyFile(copyFile.key, copyDest);
      setCopyFile(null);
      loadFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "复制失败");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedFiles.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedFiles.size} 个项目？`)) return;
    try {
      await api.deleteFiles(Array.from(selectedFiles));
      loadFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleViewModeChange = (mode: "list" | "grid") => {
    setViewMode(mode);
    localStorage.setItem("viewMode", mode);
  };

  const filteredFiles = search
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin size-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  useEffect(() => {
    if (!authLoading && initialized === false) {
      navigate("/setup", { replace: true });
    }
  }, [authLoading, initialized, navigate]);

  useEffect(() => {
    if (!authLoading && initialized && !user && !guestEnabled) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, initialized, user, guestEnabled, navigate]);

  if (initialized === false || (!user && !guestEnabled)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <CloudIcon className="size-5 text-primary" />
            <span className="font-semibold text-lg">ClouDrive</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {user.username}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {user.role === "admin" && (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <SettingsIcon className="size-4" /> 后台管理
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { logout(); navigate("/"); }}>
                    <LogOutIcon className="size-4" /> 退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
                <LogInIcon className="size-4" /> 登录
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4">
        {/* Breadcrumb + Actions */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex items-center gap-1 text-sm overflow-x-auto">
            <button
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              onClick={() => navigateTo("")}
            >
              <HomeIcon className="size-4" />
            </button>
            {breadcrumbs.map((bc) => (
              <span key={bc.path} className="flex items-center gap-1 shrink-0">
                <ChevronRightIcon className="size-3 text-muted-foreground" />
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => navigateTo(bc.path)}
                >
                  {bc.name}
                </button>
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex items-center">
              <SearchIcon className="pointer-events-none absolute left-2.5 z-10 size-4 text-muted-foreground" />
              <Input
                size="sm"
                className="w-48 [&_[data-slot=input]]:pl-7"
                placeholder="搜索文件..."
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              />
              {search && (
                <button className="absolute right-2 z-10" onClick={() => setSearch("")}>
                  <XIcon className="size-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <Button size="icon-sm" variant="ghost" onClick={loadFiles}>
              <RefreshCwIcon className="size-4" />
            </Button>
            {can("createFolder") && (
              <Button size="sm" variant="outline" onClick={() => setShowNewFolder(true)}>
                <FolderPlusIcon className="size-4" />
                <span className="hidden sm:inline">新建文件夹</span>
              </Button>
            )}
            {can("upload") && (
              <Button size="sm" onClick={() => setShowUpload(true)}>
                <UploadIcon className="size-4" />
                <span className="hidden sm:inline">上传</span>
              </Button>
            )}
          </div>
        </div>

        {/* Batch actions */}
        {selectedFiles.size > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <span className="text-sm">已选 {selectedFiles.size} 项</span>
            <Button size="xs" variant="ghost" onClick={() => setSelectedFiles(new Set())}>取消选择</Button>
            {can("delete") && (
              <Button size="xs" variant="destructive" onClick={handleBatchDelete}>
                <TrashIcon className="size-3.5" /> 删除
              </Button>
            )}
          </div>
        )}

        {/* File list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin size-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <CloudIcon className="size-12 mb-3 opacity-30" />
            <p>{search ? "没有匹配的文件" : "这里还没有文件"}</p>
            {!search && can("upload") && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowUpload(true)}>
                上传文件
              </Button>
            )}
          </div>
        ) : (
          <FileList
            files={filteredFiles}
            currentPath={currentPath}
            onNavigate={navigateTo}
            onRefresh={loadFiles}
            onPreview={setPreviewFile}
            onRename={(f) => { setRenameFile(f); setRenameName(f.name.replace(/\/$/, "")); }}
            onMove={(f) => { setMoveFile(f); setMoveDest(currentPath); }}
            onCopy={(f) => { setCopyFile(f); setCopyDest(currentPath); }}
            selectedFiles={selectedFiles}
            onSelectFile={(key, sel) => {
              setSelectedFiles((prev) => {
                const next = new Set(prev);
                sel ? next.add(key) : next.delete(key);
                return next;
              });
            }}
            onSelectAll={(sel) => {
              setSelectedFiles(sel ? new Set(filteredFiles.map((f) => f.key)) : new Set());
            }}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        )}
      </main>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>上传文件</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <FileUpload currentPath={currentPath} onComplete={loadFiles} />
          </DialogPanel>
        </DialogPopup>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <Input
              value={newFolderName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFolderName(e.target.value)}
              placeholder="文件夹名称"
              autoFocus
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleCreateFolder()}
            />
          </DialogPanel>
          <div className="flex justify-end gap-2 border-t bg-muted/50 px-6 py-4">
            <DialogClose render={<Button variant="outline">取消</Button>} />
            <Button onClick={handleCreateFolder}>创建</Button>
          </div>
        </DialogPopup>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameFile} onOpenChange={(o) => { if (!o) setRenameFile(null); }}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <Input
              value={renameName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenameName(e.target.value)}
              autoFocus
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleRename()}
            />
          </DialogPanel>
          <div className="flex justify-end gap-2 border-t bg-muted/50 px-6 py-4">
            <Button variant="outline" onClick={() => setRenameFile(null)}>取消</Button>
            <Button onClick={handleRename}>确定</Button>
          </div>
        </DialogPopup>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={!!moveFile} onOpenChange={(o) => { if (!o) setMoveFile(null); }}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>移动到</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <Input
              value={moveDest}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMoveDest(e.target.value)}
              placeholder="目标路径，如 docs/"
              autoFocus
            />
          </DialogPanel>
          <div className="flex justify-end gap-2 border-t bg-muted/50 px-6 py-4">
            <Button variant="outline" onClick={() => setMoveFile(null)}>取消</Button>
            <Button onClick={handleMove}><MoveIcon className="size-4" /> 移动</Button>
          </div>
        </DialogPopup>
      </Dialog>

      {/* Copy Dialog */}
      <Dialog open={!!copyFile} onOpenChange={(o) => { if (!o) setCopyFile(null); }}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>复制到</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <Input
              value={copyDest}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCopyDest(e.target.value)}
              placeholder="目标路径，如 backup/"
              autoFocus
            />
          </DialogPanel>
          <div className="flex justify-end gap-2 border-t bg-muted/50 px-6 py-4">
            <Button variant="outline" onClick={() => setCopyFile(null)}>取消</Button>
            <Button onClick={handleCopy}><CopyIcon className="size-4" /> 复制</Button>
          </div>
        </DialogPopup>
      </Dialog>

      {/* Preview */}
      <FilePreview
        file={previewFile}
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
