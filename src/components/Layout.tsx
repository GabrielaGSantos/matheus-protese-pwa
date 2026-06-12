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
        
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all border border-[#E2E8F0]"
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:w-60 flex-col bg-white border-r border-[#E2E8F0] sticky top-0 h-screen p-5 z-40">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-7 h-7 rounded-lg bg-[#0F766E] flex items-center justify-center text-white font-semibold text-sm">
            M
          </div>
          <div>
            <h1 className="font-semibold text-xs leading-tight text-[#0F172A]">
              {user.role === 'secretary' ? 'Secretária' : 'Dr. Matheus'}
            </h1>
            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-medium">
              Odontologia Digital
            </p>
          </div>
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-[#E2E8F0] mb-4">
          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
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
        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => {
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
          })}
        </nav>

        {/* Footer / Logout */}
        <div className="pt-4 border-t border-[#E2E8F0]">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-all duration-200"
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

          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => {
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
            })}
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
    </div>
  );
};
