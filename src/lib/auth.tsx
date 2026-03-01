import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, type User, type Permissions } from "@/lib/api";

const GUEST_PERMISSIONS: Permissions = {
  upload: false, delete: false, createFolder: false,
  move: false, copy: false, rename: false,
  preview: true, download: true,
};

interface AuthCtx {
  user: User | null;
  token: string | null;
  initialized: boolean | null;
  guestEnabled: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  setup: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  can: (p: keyof Permissions) => boolean;
}

const AuthContext = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [guestEnabled, setGuestEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const status = await api.getStatus();
      setInitialized(status.initialized);
      setGuestEnabled(status.guestEnabled);
      if (token) {
        try {
          const { user: u } = await api.me();
          setUser(u);
        } catch {
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
        }
      }
    } catch {
      // server unreachable
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  };

  const setup = async (username: string, password: string) => {
    const res = await api.setup(username, password);
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    setInitialized(true);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const can = (p: keyof Permissions): boolean => {
    if (user) return user.role === "admin" || user.permissions[p];
    return guestEnabled ? GUEST_PERMISSIONS[p] : false;
  };

  return (
    <AuthContext.Provider value={{ user, token, initialized, guestEnabled, loading, login, setup, logout, refresh, can }}>
      {children}
    </AuthContext.Provider>
  );
}
