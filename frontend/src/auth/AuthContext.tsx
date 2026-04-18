import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { getCurrentUser, fetchAuthSession, signOut as amplifySignOut } from 'aws-amplify/auth';

interface AuthState {
  userId: string | null;
  idToken: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  userId: null,
  idToken: null,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const { userId: uid } = await getCurrentUser();
      const session = await fetchAuthSession();
      setUserId(uid);
      setIdToken(session.tokens?.idToken?.toString() ?? null);
    } catch {
      // Not signed in -- clear state
      setUserId(null);
      setIdToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const signOut = useCallback(async () => {
    await amplifySignOut();
    setUserId(null);
    setIdToken(null);
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    await loadSession();
  }, [loadSession]);

  return (
    <AuthContext.Provider value={{ userId, idToken, loading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
