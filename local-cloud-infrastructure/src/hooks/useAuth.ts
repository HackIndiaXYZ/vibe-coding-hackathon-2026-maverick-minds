import { useState, useEffect } from 'react';

export function useAuth() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!token);
  const [loading, setLoading] = useState<boolean>(false);

  const login = async (pin: string) => {
    setLoading(true);
    try {
      const res = await window.api.login(pin);
      if (res.success && res.token) {
        localStorage.setItem('token', res.token);
        setToken(res.token);
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, error: res.error || 'Login failed' };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (token) {
      await window.api.logout(token);
    }
    localStorage.removeItem('token');
    setToken(null);
    setIsAuthenticated(false);
  };

  return { token, isAuthenticated, loading, login, logout };
}
