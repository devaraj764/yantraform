import { useState, useEffect, useCallback } from 'react';
import { api } from '~/lib/api';

export function useAuth() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const result = await api.auth.session();
      setAuthenticated(result.authenticated);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const login = async (password: string) => {
    const result = await api.auth.login(password);
    if (result.success) {
      setAuthenticated(true);
    }
    return result;
  };

  const logout = async () => {
    await api.auth.logout();
    setAuthenticated(false);
  };

  return { authenticated, loading, login, logout, refresh: check };
}
