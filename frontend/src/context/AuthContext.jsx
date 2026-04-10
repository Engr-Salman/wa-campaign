import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const authFetch = useCallback(async (url, options = {}) => {
    const t = token || localStorage.getItem('token');
    const headers = { ...options.headers };
    if (t) headers['Authorization'] = `Bearer ${t}`;
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      logout();
      throw new Error('Session expired');
    }
    return res;
  }, [token, logout]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    authFetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          logout();
        } else {
          setUser(data);
        }
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [token]);

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const refreshUser = async () => {
    try {
      const res = await authFetch('/api/auth/me');
      const data = await res.json();
      if (!data.error) setUser(data);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, authFetch, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
