import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
  FileText
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentTab, setCurrentTab }) => {
  const { user, logout, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return <>{children}</>;

  const menuItems = isAdmin ? [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cases', label: 'Casos', icon: Briefcase },
    { id: 'dentists', label: 'Dentistas', icon: Users },
    { id: 'services', label: 'Serviços', icon: Wrench },
    { id: 'finance', label: 'Financeiro & Cobrança', icon: DollarSign },
    { id: 'agenda', label: 'Agenda & Produção', icon: Calendar },
  ] : [
    { id: 'dentist-cases', label: 'Meus Casos', icon: FileText },
    { id: 'dentist-new-case', label: 'Solicitar Caso', icon: PlusCircle },
  ];

  const handleNav = (tabId: string) => {
    setCurrentTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground transition-all duration-300">
      {/* Mobile Top Header */}
      <header className="md:hidden glass-panel sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-cyan-400 flex items-center justify-center text-white font-bold text-lg shadow-md">
            M
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
            Iorc Lab
          </span>
        </div>
        
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-secondary/80 text-foreground hover:bg-secondary transition-all"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:w-64 flex-col glass-panel border-r border-white/10 sticky top-0 h-screen p-6 shadow-lg z-40">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-cyan-400 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/20">
            M
          </div>
          <div>
            <h1 className="font-extrabold text-lg leading-tight bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
              {user.role === 'secretary' ? 'Secretária' : 'Dr. Matheus'}
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
              Odontologia Digital
            </p>
          </div>
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-white/5 mb-6">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <User size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold truncate text-foreground">{user.full_name}</h4>
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-bold uppercase mt-0.5 bg-primary/20 text-primary-foreground text-primary dark:bg-primary/30">
              {user.role === 'admin' ? 'Matheus (Admin)' : user.role === 'secretary' ? 'Secretária' : 'Dentista'}
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 translate-x-1' 
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-muted-foreground'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer / Logout */}
        <div className="pt-4 border-t border-white/10">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all duration-300"
          >
            <LogOut size={18} />
            Sair da Conta
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-background/90 backdrop-blur-lg z-40 flex flex-col p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-cyan-400 flex items-center justify-center text-white font-bold text-lg">
                M
              </div>
              <span className="font-extrabold text-xl">Iorc Lab</span>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg bg-secondary text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mobile User Details */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <User size={20} />
            </div>
            <div>
              <h4 className="font-bold text-base">{user.full_name}</h4>
              <span className="text-xs font-semibold text-primary">{isAdmin ? 'Admin' : 'Dentista'}</span>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl text-base font-semibold transition-all ${
                    isActive 
                      ? 'bg-primary text-primary-foreground shadow-lg' 
                      : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <Icon size={20} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-xl text-base font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 transition-all mt-4"
          >
            <LogOut size={20} />
            Sair da Conta
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-full">
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};
