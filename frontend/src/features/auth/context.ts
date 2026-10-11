import { createContext } from 'react';
import type { RegisterPayload, User } from '@/api/auth';

export interface AuthContextValue {
  user: User | null;
  /** true mientras se intenta recuperar la sesión al cargar la app */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
