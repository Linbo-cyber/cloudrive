import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadIcon, XIcon } from "lucide-react";

interface Props {
  currentPath: string;
  onComplete: () => void;
}

interface UploadTask {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export default function FileUpload({ currentPath, onComplete }: Props) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | File[]) => {
    const newTasks: UploadTask[] = Array.from(fileList).map((file) => ({
      file,
      progress: 0,
      status: "pending" as const,
    }));
    setTasks((prev) => [...prev, ...newTasks]);
    newTasks.forEach((task, i) => {
      uploadFile(task, tasks.length + i);
    });
  };

  const uploadFile = async (task: UploadTask, index: number) => {
    const update = (patch: Partial<UploadTask>) => {
      setTasks((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
    };
    update({ status: "uploading" });
    try {
      await api.upload(currentPath + task.file.name, task.file, (pct) => {
        update({ progress: pct });
      });
      update({ status: "done", progress: 100 });
      onComplete();
    } catch (err) {
      update({ status: "error", error: err instanceof Error ? err.message : "上传失败" });
    }
  };

  const clearDone = () => {
    setTasks((prev) => prev.filter((t) => t.status !== "done"));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const activeTasks = tasks.filter((t) => t.status !== "done");

  return (
    <div>
      <div
        className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <UploadIcon className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="mb-2 text-sm text-muted-foreground">拖拽文件到此处，或</p>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          选择文件
        </Button>
      </div>

      {tasks.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {activeTasks.length > 0 ? `${activeTasks.length} 个文件上传中` : "全部完成"}
            </span>
            {activeTasks.length === 0 && (
              <Button size="xs" variant="ghost" onClick={clearDone}>清除</Button>
            )}
          </div>
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{task.file.name}</p>
                {task.status === "uploading" && (
                  <Progress value={task.progress} className="mt-1 h-1" />
                )}
                {task.status === "error" && (
                  <p className="text-xs text-destructive">{task.error}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {task.status === "done" && "✓"}
                {task.status === "uploading" && `${task.progress}%`}
                {task.status === "error" && (
                  <Button size="icon-xs" variant="ghost" onClick={() => uploadFile(task, i)}>
                    重试
                  </Button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
