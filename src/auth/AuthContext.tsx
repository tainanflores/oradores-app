import React, { createContext, useContext, useEffect, useState } from "react";

type User = {
  email: string;
  name: string;
  picture: string;
};

type AuthContextType = {
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("google_token");
    if (token) {
      try {
        setUser(decodeJwt(token));
      } catch {
        localStorage.removeItem("google_token");
      }
    }
  }, []);

  function login(token: string) {
    localStorage.setItem("google_token", token);
    setUser(decodeJwt(token));
  }

  function logout() {
    localStorage.removeItem("google_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// 🔐 JWT decode simples
function decodeJwt(token: string): User {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64));
}
