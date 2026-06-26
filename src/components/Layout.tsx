import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Wrench, 
  DollarSign, 
  Calendar, 
  LogOut, 
  Menu, 
  X, 
  User,
  PlusCircle,
  FileText,
  KeyRound,
  Bell,
  Settings,
  StickyNote
} from 'lucide-react';
import { notificationService } from '../services/notifications';
import type { AppNotification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentTab, setCurrentTab }) => {
  const { user, logout, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Notifications and Case Counters states
  const [casesCount, setCasesCount] = useState({ open: 0, delivered: 0 });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    await logout();
  };

  useEffect(() => {
    if (isAdmin) {
      api.profiles.list().then(profs => {
        const gab = profs.find(p => p.full_name?.toLowerCase().includes('gabriela') && p.role === 'dentist');
        if (gab) {
          api.profiles.save({ ...gab, role: 'secretary' }).then(() => console.log('Gabriela upgraded to secretary'));
        }
      });
    }
  }, [isAdmin]);

  const fetchCasesCount = async () => {
    if (!isAdmin || !user) return;
    try {
      const cases = await api.cases.list('admin', user.id);
      const open = cases.filter(c => c.status !== 'entregue').length;
      const delivered = cases.filter(c => c.status === 'entregue').length;
      setCasesCount({ open, delivered });
    } catch (err) {
      console.error('Erro ao carregar contadores:', err);
    }
  };

  const loadNotifications = () => {
    setNotifications(notificationService.list());
  };

  useEffect(() => {
    if (!user) return;
    fetchCasesCount();
    loadNotifications();

    const interval = setInterval(fetchCasesCount, 8000);

    // Ouvir novos disparos de notificações em tempo real na aba aberta
    window.addEventListener('new_notification_received', loadNotifications);

    return () => {
      clearInterval(interval);
      window.removeEventListener('new_notification_received', loadNotifications);
    };
  }, [user, isAdmin, currentTab]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isNotifOpen && notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotifOpen]);

  if (!user) return <>{children}</>;

  const menuItems = isAdmin ? [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cases-open', label: 'Abertos', icon: Briefcase, isSubCase: true, count: casesCount.open },
    { id: 'cases-delivered', label: 'Entregues', icon: Briefcase, isSubCase: true, count: casesCount.delivered },
    { id: 'dentists', label: 'Dentistas', icon: Users },
    { id: 'services', label: 'Serviços', icon: Wrench },
    { id: 'finance', label: 'Financeiro & Cobrança', icon: DollarSign },
    { id: 'agenda', label: 'Agenda & Produção', icon: Calendar },
    { id: 'notes', label: 'Bloco de Notas', icon: StickyNote },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ] : [
    { id: 'dentist-cases', label: 'Meus Casos', icon: FileText },
    { id: 'dentist-new-case', label: 'Solicitar Caso', icon: PlusCircle },
  ];

  const handleNav = (tabId: string) => {
    setCurrentTab(tabId);
    setMobileMenuOpen(false);
    setIsNotifOpen(false);
  };

  const renderNotificationsDropdown = () => {
    const unreadCount = notifications.filter(n => !n.is_read).length;
    return (
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setIsNotifOpen(!isNotifOpen)}
          className="w-9 h-9 rounded-lg bg-slate-50 hover:bg-slate-100 border border-[#E2E8F0] flex items-center justify-center text-slate-500 hover:text-[#0F766E] transition-all cursor-pointer relative"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {isNotifOpen && (
          <div className="absolute right-0 md:left-0 md:right-auto mt-2 w-72 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 p-4 space-y-3 animate-fade-in text-slate-900 text-left">
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2">
              <span className="text-xs font-bold text-slate-900">Notificações</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    notificationService.markAllAsRead();
                    loadNotifications();
                  }}
                  className="text-[9px] font-bold text-[#0F766E] hover:underline bg-transparent border-none p-0 cursor-pointer"
                >
                  Ler tudo
                </button>
                <button
                  onClick={() => {
                    notificationService.clearAll();
                    loadNotifications();
                  }}
                  className="text-[9px] font-bold text-rose-600 hover:underline bg-transparent border-none p-0 cursor-pointer"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {notifications.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-[10px] italic">
                  Nenhuma notificação recente
                </div>
              ) : (
                notifications.slice(0, 5).map(n => (
                  <div
                    key={n.id}
                    onClick={() => {
                      notificationService.markAsRead(n.id);
                      loadNotifications();
                      setIsNotifOpen(false);
                      // Se houver um caso específico vinculado, navega até a listagem e ativa o editor
                      if (n.case_id) {
                        setCurrentTab('cases-open');
                        // Um pequeno hack para forçar re-render ou abrir o modal
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('open_case_editor', { detail: n.case_id }));
                        }, 100);
                      }
                    }}
                    className={`p-2 rounded-lg border text-[10px] cursor-pointer transition-all ${
                      n.is_read ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-teal-50/50 border-teal-100 text-slate-800 font-semibold shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="font-bold truncate max-w-[150px]">{n.title}</span>
                      <span className="text-[8px] text-slate-400 font-medium">
                        {(() => {
                          if (!n.created_at) return '';
                          const d = new Date(n.created_at);
                          return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        })()}
                      </span>
                    </div>
                    <p className="line-clamp-2 leading-tight text-slate-600 font-normal">{n.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="text-center border-t border-[#E2E8F0] pt-2">
              <button
                onClick={() => {
                  setIsNotifOpen(false);
                  setCurrentTab('settings');
                }}
                className="text-[10px] font-bold text-[#0F766E] hover:underline bg-transparent border-none p-0 cursor-pointer w-full text-center"
              >
                Ver todo o histórico
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC] text-[#0F172A] transition-all duration-300">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-white sticky top-0 z-50 flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0F766E] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            M
          </div>
          <span className="font-bold text-lg tracking-tight text-[#0F172A]">
            Iorc Lab
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {isAdmin && renderNotificationsDropdown()}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all border border-[#E2E8F0]"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:w-60 flex-col bg-white border-r border-[#E2E8F0] sticky top-0 h-screen p-5 z-40">
        {/* Logo */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0F766E] flex items-center justify-center text-white font-semibold text-sm">
              M
            </div>
            <div>
              <div className="font-semibold text-[20px] leading-tight text-[#0F172A]">
                {user.role === 'secretary' ? 'Secretária' : 'Dr. Matheus'}
              </div>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-medium">
                Odontologia Digital
              </p>
            </div>
          </div>
          {isAdmin && renderNotificationsDropdown()}
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-[#E2E8F0] mb-4">
          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
            <User size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[11px] font-semibold truncate text-[#0F172A]">{user.full_name}</h4>
            <span className="inline-block text-[9px] px-1.5 py-px rounded-full font-medium mt-0.5 bg-[#ECFDF5] text-[#0F766E] border border-emerald-100">
              {user.role === 'admin' ? 'Admin' : user.role === 'secretary' ? 'Secretária' : 'Dentista'}
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {(() => {
            let renderedCasesHeader = false;
            return menuItems.map((item) => {
              if ('isSubCase' in item && item.isSubCase) {
                const isActive = currentTab === item.id;
                const elements = [];
                if (!renderedCasesHeader) {
                  renderedCasesHeader = true;
                  elements.push(
                    <div key="cases-header" className="flex items-center gap-2 px-3.5 py-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-4">
                      <Briefcase size={12} className="text-[#64748B]" />
                      <span>Casos</span>
                    </div>
                  );
                }
                elements.push(
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={`w-full flex items-center justify-between pl-8 pr-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive 
                        ? 'bg-[#ECFDF5] text-[#0F766E] font-semibold' 
                        : 'text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#0F766E]' : 'bg-slate-300'}`} />
                      <span>{item.label}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-px rounded-full font-bold ${
                      isActive ? 'bg-emerald-100/60 text-[#0F766E]' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {item.count}
                    </span>
                  </button>
                );
                return elements;
              }

              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive 
                      ? 'bg-[#ECFDF5] text-[#0F766E] font-semibold' 
                      : 'text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-[#0F766E]' : 'text-[#64748B]'} />
                  {item.label}
                </button>
              );
            });
          })()}
        </nav>

        {/* Footer / Logout */}
        <div className="pt-4 border-t border-[#E2E8F0] space-y-1">
          {(user.role === 'admin' || user.role === 'secretary') && (
            <button 
              onClick={() => setIsPasswordModalOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-[#0F172A] transition-all duration-200 cursor-pointer"
            >
              <KeyRound size={16} className="text-slate-400" />
              Alterar Senha
            </button>
          )}
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-all duration-200 cursor-pointer"
          >
            <LogOut size={16} />
            Sair da Conta
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-white z-40 flex flex-col p-5 animate-fade-in border-r border-[#E2E8F0]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0F766E] flex items-center justify-center text-white font-bold text-lg">
                M
              </div>
              <span className="font-bold text-lg text-[#0F172A]">Iorc Lab</span>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg bg-slate-50 border border-[#E2E8F0] text-slate-600"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mobile User Details */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-[#E2E8F0] mb-6">
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
              <User size={18} />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[#0F172A]">{user.full_name}</h4>
              <span className="text-xs font-semibold text-[#0F766E]">{isAdmin ? 'Admin' : 'Dentista'}</span>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {(() => {
              let renderedCasesHeader = false;
              return menuItems.map((item) => {
                if ('isSubCase' in item && item.isSubCase) {
                  const isActive = currentTab === item.id;
                  const elements = [];
                  if (!renderedCasesHeader) {
                    renderedCasesHeader = true;
                    elements.push(
                      <div key="m-cases-header" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">
                        <Briefcase size={14} />
                        <span>Casos</span>
                      </div>
                    );
                  }
                  elements.push(
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center justify-between pl-8 pr-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        isActive 
                          ? 'bg-[#ECFDF5] text-[#0F766E]' 
                          : 'text-[#64748B] hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#0F766E]' : 'bg-slate-300'}`} />
                        <span>{item.label}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-px rounded-full font-bold ${
                        isActive ? 'bg-emerald-100 text-[#0F766E]' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {item.count}
                      </span>
                    </button>
                  );
                  return elements;
                }

                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                      isActive 
                        ? 'bg-[#ECFDF5] text-[#0F766E]' 
                        : 'text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              });
            })()}
          </nav>

          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-lg text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all mt-4"
          >
            <LogOut size={18} />
            Sair da Conta
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-5 md:p-8 overflow-y-auto max-w-full">
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
          {children}
        </div>
      </main>
      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.08)] p-6 relative text-slate-900 animate-fade-in">
            <button
              onClick={() => {
                setIsPasswordModalOpen(false);
                setNewPassword('');
                setConfirmPassword('');
                setPassError('');
                setPassSuccess('');
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white border border-[#E2E8F0] text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1">Alterar Senha</h3>
            <p className="text-[11px] text-slate-500 mb-4">
              Defina sua nova senha de acesso ao painel do Iorc Lab.
            </p>

            {passError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium mb-4">
                {passError}
              </div>
            )}

            {passSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-medium mb-4">
                {passSuccess}
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              setPassError('');
              setPassSuccess('');
              if (!newPassword) {
                setPassError('Por favor, insira uma nova senha.');
                return;
              }
              if (newPassword !== confirmPassword) {
                setPassError('As senhas não coincidem.');
                return;
              }
              setSubmitting(true);
              try {
                await api.auth.updatePassword(newPassword);
                setPassSuccess('Senha atualizada com sucesso!');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => {
                  setIsPasswordModalOpen(false);
                  setPassSuccess('');
                }, 1500);
              } catch (err: any) {
                setPassError('Erro ao atualizar a senha.');
              } finally {
                setSubmitting(false);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                  Nova Senha
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Insira a nova senha"
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme a nova senha"
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setPassError('');
                    setPassSuccess('');
                  }}
                  className="px-4 py-2 bg-white border border-[#E2E8F0] text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Atualizando...' : 'Atualizar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
