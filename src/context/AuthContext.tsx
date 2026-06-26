import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Profile } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isAuxiliar: boolean;
  linkedDentistId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  async function syncGDriveSettings() {
    try {
      const settings = await api.gdrive.getSettings();
      if (settings) {
        if (settings.access_token) {
          localStorage.setItem('gdrive_access_token', settings.access_token);
        } else {
          localStorage.removeItem('gdrive_access_token');
        }
        if (settings.token_expiry) {
          localStorage.setItem('gdrive_token_expiry', String(settings.token_expiry));
        } else {
          localStorage.removeItem('gdrive_token_expiry');
        }
        if (settings.root_folder_id) {
          localStorage.setItem('google_drive_root_folder_id', settings.root_folder_id);
        }
        if (settings.root_folder_url) {
          localStorage.setItem('google_drive_root_url', settings.root_folder_url);
        }
        if (settings.user_email) {
          localStorage.setItem('gdrive_user_email', settings.user_email);
        } else {
          localStorage.removeItem('gdrive_user_email');
        }
        if (settings.user_name) {
          localStorage.setItem('gdrive_user_name', settings.user_name);
        } else {
          localStorage.removeItem('gdrive_user_name');
        }
      }
    } catch (err) {
      console.error('Erro ao sincronizar configurações do Google Drive:', err);
    }
  }

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await api.auth.getCurrentUser();
        setUser(currentUser);
        if (currentUser) {
          await syncGDriveSettings();
        }
      } catch (err) {
        console.error('Erro ao validar sessão:', err);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const login = async (email: string, password?: string) => {
    setLoading(true);
    try {
      const loggedUser = await api.auth.login(email, password);
      setUser(loggedUser);
      await syncGDriveSettings();
      
      // Registrar login no log (via Telegram se configurado)
      try {
        const { notificationService } = await import('../services/notifications');
        notificationService.sendTelegramEvent({
          action: 'system_login',
          userName: loggedUser.full_name,
          email: loggedUser.email || email,
          role: loggedUser.role
        });
      } catch(e) {
        console.error('Erro ao registrar log de acesso', e);
      }
      
    } catch (err) {
      console.error('Erro de login:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.auth.logout();
      setUser(null);
    } catch (err) {
      console.error('Erro ao sair:', err);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAdmin: user?.role === 'admin' || user?.role === 'secretary',
    isAuxiliar: user?.role === 'auxiliar',
    linkedDentistId: user?.role === 'auxiliar' ? (user?.linked_dentist_id || null) : null
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
