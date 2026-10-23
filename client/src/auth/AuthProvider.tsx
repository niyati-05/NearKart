import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  registerCustomer,
  registerSeller,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
  type Role,
} from '../api/auth';
import { ApiError } from '../api/client';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput, role: Extract<Role, 'customer' | 'seller'>) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: current } = await getCurrentUser();
      setUser(current);
    } catch (error) {
      // 401 simply means "not signed in"; anything else is also treated as
      // signed out here, but the login page reports real server errors.
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.warn('[auth] Could not restore session:', error);
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (input: LoginInput) => {
    const { user: signedIn } = await loginRequest(input);
    setUser(signedIn);
  }, []);

  const register = useCallback(
    async (
      input: RegisterInput,
      role: Extract<Role, 'customer' | 'seller'>,
    ) => {
      const { user: created } =
        role === 'seller'
          ? await registerSeller(input)
          : await registerCustomer(input);
      setUser(created);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch (error) {
      // A 401 means the session was already gone; clear the UI anyway. Any
      // other failure is reported so the user knows the token may persist.
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
