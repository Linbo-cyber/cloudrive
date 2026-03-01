import { useState, useEffect } from "react";
import { api, type User, type Permissions } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogPopup, DialogHeader, DialogTitle, DialogDescription, DialogPanel, DialogClose,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  ArrowLeftIcon, PlusIcon, TrashIcon, PencilIcon, UserIcon, UsersIcon, FolderIcon,
} from "lucide-react";

const ALL_PERMS: { key: keyof Permissions; label: string }[] = [
  { key: "upload", label: "上传" },
  { key: "download", label: "下载" },
  { key: "preview", label: "预览" },
  { key: "delete", label: "删除" },
  { key: "createFolder", label: "创建文件夹" },
  { key: "move", label: "移动" },
  { key: "copy", label: "复制" },
  { key: "rename", label: "重命名" },
];

const DEFAULT_PERMS: Permissions = {
  upload: true, download: true, preview: true, delete: false,
  createFolder: true, move: true, copy: true, rename: true,
};

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [guestEnabled, setGuestEnabled] = useState(true);
  const [guestPath, setGuestPath] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPerms, setNewPerms] = useState<Permissions>(DEFAULT_PERMS);
  const [editPassword, setEditPassword] = useState("");
  const [editPerms, setEditPerms] = useState<Permissions>(DEFAULT_PERMS);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") { navigate("/"); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [u, g] = await Promise.all([api.listUsers(), api.getGuestConfig()]);
      setUsers(u.users);
      setGuestEnabled(g.enabled);
      setGuestPath(g.path || "");
    } catch {}
  };

  const handleCreateUser = async () => {
    setError("");
    if (!newUsername.trim() || !newPassword.trim()) { setError("用户名和密码不能为空"); return; }
    if (newPassword.length < 6) { setError("密码至少 6 位"); return; }
    try {
      await api.createUser(newUsername.trim(), newPassword, newPerms);
      setShowCreate(false);
      setNewUsername("");
      setNewPassword("");
      setNewPerms(DEFAULT_PERMS);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  };

  const handleUpdateUser = async () => {
    if (!editUser) return;
    setError("");
    try {
      const data: { password?: string; permissions?: Permissions } = { permissions: editPerms };
      if (editPassword.trim()) {
        if (editPassword.length < 6) { setError("密码至少 6 位"); return; }
        data.password = editPassword;
      }
      await api.updateUser(editUser.username, data);
      setEditUser(null);
      setEditPassword("");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!confirm(`确定删除用户 ${username}？`)) return;
    try {
      await api.deleteUser(username);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleGuestToggle = async (enabled: boolean) => {
    try {
      await api.setGuestConfig(enabled, guestPath);
      setGuestEnabled(enabled);
    } catch {}
  };

  const handleGuestPathSave = async () => {
    try {
      await api.setGuestConfig(guestEnabled, guestPath);
    } catch {}
  };

  const togglePerm = (perms: Permissions, key: keyof Permissions): Permissions => ({
    ...perms, [key]: !perms[key],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <Button size="icon-sm" variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <h1 className="text-2xl font-semibold">后台管理</h1>
        </div>

        {/* Guest 设置 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-5" /> 访客设置
            </CardTitle>
            <CardDescription>访客无需登录即可浏览文件，仅有预览和下载权限</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Label>启用访客访问</Label>
              <Switch checked={guestEnabled} onCheckedChange={handleGuestToggle} />
            </div>
            {guestEnabled && (
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-1.5">
                  <FolderIcon className="size-3.5" /> 访客可访问路径
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={guestPath}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestPath(e.target.value)}
                    placeholder="留空表示可访问全部文件"
                    size="sm"
                  />
                  <Button size="sm" variant="outline" onClick={handleGuestPathSave}>保存</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  例如填 <code className="rounded bg-muted px-1">public/</code> 则访客只能浏览 public 文件夹下的内容
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="size-5" /> 用户管理
                </CardTitle>
                <CardDescription>{users.length} 个用户</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <PlusIcon className="size-4" /> 新建用户
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead className="hidden sm:table-cell">权限</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.username}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "outline"} size="sm">
                        {u.role === "admin" ? "管理员" : "用户"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {u.role === "admin" ? (
                        <span className="text-sm text-muted-foreground">全部权限</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {ALL_PERMS.filter((p) => u.permissions[p.key]).map((p) => (
                            <Badge key={p.key} variant="secondary" size="sm">{p.label}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.role !== "admin" && (
                        <div className="flex gap-1">
                          <Button
                            size="icon-xs" variant="ghost"
                            onClick={() => { setEditUser(u); setEditPerms(u.permissions); setEditPassword(""); setError(""); }}
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-xs" variant="ghost"
                            onClick={() => handleDeleteUser(u.username)}
                          >
                            <TrashIcon className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 创建用户 Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>新建用户</DialogTitle>
              <DialogDescription>创建新用户并设置权限</DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <div className="flex flex-col gap-4">
                {error && (
                  <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
                )}
                <div className="flex flex-col gap-2">
                  <Label>用户名</Label>
                  <Input value={newUsername} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUsername(e.target.value)} placeholder="用户名" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>密码</Label>
                  <Input type="password" value={newPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)} placeholder="至少 6 位" />
                </div>
                <Separator />
                <div className="flex flex-col gap-2">
                  <Label>权限</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_PERMS.map((p) => (
                      <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={newPerms[p.key]} onCheckedChange={() => setNewPerms(togglePerm(newPerms, p.key))} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </DialogPanel>
            <div className="flex justify-end gap-2 border-t bg-muted/50 px-6 py-4">
              <DialogClose render={<Button variant="outline">取消</Button>} />
              <Button onClick={handleCreateUser}>创建</Button>
            </div>
          </DialogPopup>
        </Dialog>

        {/* 编辑用户 Dialog */}
        <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>编辑用户: {editUser?.username}</DialogTitle>
            </DialogHeader>
            <DialogPanel>
              <div className="flex flex-col gap-4">
                {error && (
                  <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
                )}
                <div className="flex flex-col gap-2">
                  <Label>新密码（留空不修改）</Label>
                  <Input type="password" value={editPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditPassword(e.target.value)} placeholder="留空不修改" />
                </div>
                <Separator />
                <div className="flex flex-col gap-2">
                  <Label>权限</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_PERMS.map((p) => (
                      <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={editPerms[p.key]} onCheckedChange={() => setEditPerms(togglePerm(editPerms, p.key))} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </DialogPanel>
            <div className="flex justify-end gap-2 border-t bg-muted/50 px-6 py-4">
              <Button variant="outline" onClick={() => setEditUser(null)}>取消</Button>
              <Button onClick={handleUpdateUser}>保存</Button>
            </div>
          </DialogPopup>
        </Dialog>
      </div>
    </div>
  );
}
