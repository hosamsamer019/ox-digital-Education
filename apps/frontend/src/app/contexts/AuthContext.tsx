import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import axios from 'axios';
import { authApi } from '../services/api';

export type UserRole = 'ONLINE_STUDENT' | 'CENTER_STUDENT' | 'TEACHER' | 'ADMIN' | 'PARENT' | 'PRIMARY_MANAGER' | 'ACCOUNTANT';

export function getDefaultRouteForRole(role?: UserRole | string | null): string {
  switch (role) {
    case 'ONLINE_STUDENT':
      return '/student/online/home';
    case 'CENTER_STUDENT':
      return '/student/center/home';
    case 'TEACHER':
      return '/teacher/home';
    case 'PARENT':
      return '/parent/home';
    case 'ADMIN':
    case 'PRIMARY_MANAGER':
      return '/admin/home';
    case 'ACCOUNTANT':
      return '/accountant/home';
    default:
      return '/';
  }
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  profilePictureUrl?: string | null;
  phone?: string;
  grade?: string;
  institution?: string;
  institutionId?: string;
  branchId?: string;
  branch?: { id: string; name: string; code: string };
  subscriptionPlan?: 'basic' | 'pro' | 'enterprise';
  isActive: boolean;
  mustChangePassword?: boolean;
  financialAccessStatus?: 'ACTIVE' | 'RESTRICTED';
  parentId?: string;
  parent?: { id: string; name: string; email: string; phone?: string | null };
  children?: Array<{ id: string; name: string; email: string; role: string }>;
  centerGroupId?: string;
  centerGroup?: any; // extended data from profile
  theme?: string;
  language?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole) => Promise<any>;
  markPasswordChanged: (newToken?: string) => void;
  loginGuest: (name: string, phone: string, code: string) => Promise<{ success: boolean; assessmentId?: string; message?: string; code?: string; openAt?: string | null; closeAt?: string | null; user?: any }>;
  register: (data: { name: string; email: string; password: string; role: UserRole }) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('edu-user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const syncAuth = (e: StorageEvent) => {
      if (e.key === 'edu-user') {
        setUser(e.newValue ? JSON.parse(e.newValue) : null);
      }
      if (e.key === 'token' && !e.newValue) {
        setUser(null);
      }
    };
    window.addEventListener('storage', syncAuth);
    return () => window.removeEventListener('storage', syncAuth);
  }, []);

  const fetchExtendedProfile = async (baseUser: Partial<User>) => {
    try {
      const { userService } = await import('../services/user.service');
      const profile = await userService.getProfile();
      return { ...baseUser, ...profile } as User;
    } catch (e) {
      console.warn('Failed to fetch extended profile, using base user');
      return baseUser as User;
    }
  };

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      try {
        localStorage.setItem('edu-user', JSON.stringify(updated));
      } catch {
        // Restricted storage
      }
      return updated;
    });
  }, []);

  const applyUserPreferences = (userObj: any) => {
    if (!userObj) return;

    // Theme synchronization
    if (userObj.theme) {
      localStorage.setItem('preferred_theme', userObj.theme);
      localStorage.setItem('edu-theme', userObj.theme);
      document.documentElement.setAttribute('data-theme', userObj.theme);
      if (['dark', 'blue', 'green', 'purple', 'warm-orange'].includes(userObj.theme)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    // Language synchronization
    if (userObj.language) {
      const lang = userObj.language === 'en' ? 'en' : 'ar';
      localStorage.setItem('preferred_language', lang);
      localStorage.setItem('edu-lang', lang === 'en' ? 'ENGLISH' : 'ARABIC');
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:preference-sync', {
        detail: {
          language: userObj.language === 'en' ? 'en' : 'ar',
          theme: userObj.theme || 'default'
        }
      }));
    }
  };

  const login = async (email: string, password: string, role: UserRole): Promise<any> => {
    try {
      const response = await authApi.post('/login', { email, password, role });
      const { token, user: loggedUser, mustChangePassword } = response.data;
      
      localStorage.setItem('token', token);
      
      // Fetch extended profile
      const fullUser = await fetchExtendedProfile({
        ...loggedUser,
        mustChangePassword: Boolean(mustChangePassword ?? loggedUser?.mustChangePassword)
      });
      
      setUser(fullUser);
      localStorage.setItem('edu-user', JSON.stringify(fullUser));
      applyUserPreferences(fullUser);
      
      return { success: true, user: fullUser, mustChangePassword: Boolean(mustChangePassword ?? loggedUser?.mustChangePassword) };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Expected invalid credentials: do not console.error
      } else {
        console.error('Login failed:', error);
      }
      return false;
    }
  };

  const markPasswordChanged = (newToken?: string) => {
    if (newToken) {
      localStorage.setItem('token', newToken);
    }
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, mustChangePassword: false };
      localStorage.setItem('edu-user', JSON.stringify(updated));
      return updated;
    });
  };

  const loginGuest = async (name: string, phone: string, code: string) => {
    try {
      const res = await authApi.post('/guest-login', { name, phone, code });
      return res.data;
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || err.message };
    }
  };

  const register = async (data: { name: string; email: string; password: string; role: UserRole }): Promise<void> => {
    const response = await authApi.post('/register', data);
    const { token, user: registeredUser } = response.data;
    
    localStorage.setItem('token', token);
    const fullUser = await fetchExtendedProfile(registeredUser);
    
    setUser(fullUser);
    localStorage.setItem('edu-user', JSON.stringify(fullUser));
    applyUserPreferences(fullUser);
  };

  const logout = async () => {
    try {
      await authApi.post('/logout');
    } catch (error) {
      console.error('Logout API failed:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('edu-user');
      // Clear preferences on logout to prevent leakage between users on shared devices
      localStorage.removeItem('preferred_language');
      localStorage.removeItem('edu-lang');
      localStorage.removeItem('preferred_theme');
      localStorage.removeItem('edu-theme');
      localStorage.removeItem('theme');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:preference-sync', {
          detail: {
            language: 'ar',
            theme: 'dark'
          }
        }));
      }
    }
  };

  const checkAuth = async () => {
    try {
      let baseUser: any = null;
      try {
        const res = await authApi.get('/me');
        baseUser = res.data;
      } catch {
        // Fallback if /me fails
        const { userService } = await import('../services/user.service');
        baseUser = await userService.getProfile();
      }
      
      if (baseUser) {
        const fullUser = await fetchExtendedProfile(baseUser);
        setUser(fullUser);
        localStorage.setItem('edu-user', JSON.stringify(fullUser));
        applyUserPreferences(fullUser);
      }
    } catch (err) {
      console.error('checkAuth failed:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, loginGuest, register, logout, checkAuth, markPasswordChanged, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
