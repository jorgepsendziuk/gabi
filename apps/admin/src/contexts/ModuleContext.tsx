import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '../lib/api';

export interface GabiModule {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  pageCount?: number;
}

const STORAGE_KEY = 'gabi_active_module';

interface ModuleContextValue {
  modules: GabiModule[];
  activeModuleId: string | null;
  activeModule: GabiModule | null;
  setActiveModuleId: (id: string | null) => void;
  refreshModules: () => Promise<void>;
  loading: boolean;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [modules, setModules] = useState<GabiModule[]>([]);
  const [activeModuleId, setActiveModuleIdState] = useState<string | null>(() => {
    const v = localStorage.getItem(STORAGE_KEY);
    return v || null;
  });
  const [loading, setLoading] = useState(true);

  const refreshModules = useCallback(async () => {
    const list = await apiFetch<GabiModule[]>('/api/modules');
    setModules(list);
    if (activeModuleId && !list.some((m) => m.id === activeModuleId)) {
      setActiveModuleIdState(null);
    }
  }, [activeModuleId]);

  useEffect(() => {
    setLoading(true);
    refreshModules()
      .catch(() => setModules([]))
      .finally(() => setLoading(false));
  }, []);

  const setActiveModuleId = useCallback((id: string | null) => {
    setActiveModuleIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const activeModule = useMemo(
    () => modules.find((m) => m.id === activeModuleId) ?? null,
    [modules, activeModuleId],
  );

  const value = useMemo(
    () => ({
      modules,
      activeModuleId,
      activeModule,
      setActiveModuleId,
      refreshModules,
      loading,
    }),
    [modules, activeModuleId, activeModule, setActiveModuleId, refreshModules, loading],
  );

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
}

export function useModules() {
  const ctx = useContext(ModuleContext);
  if (!ctx) throw new Error('useModules deve ser usado dentro de ModuleProvider');
  return ctx;
}
