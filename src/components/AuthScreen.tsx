import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Mail } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Por favor, informe seu e-mail.');
      return;
    }
    if (!password) {
      setErrorMsg('Por favor, informe sua senha.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      let loginEmail = email.trim();
      if (!loginEmail.includes('@')) {
        loginEmail = `${loginEmail}@iorclab.com`;
      }
      await login(loginEmail, password);
    } catch (err: any) {
      setErrorMsg('Falha na autenticação. Verifique usuário e senha.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAFC]">
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(15,23,42,0.08)] p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#0F766E] flex items-center justify-center text-white text-lg font-bold mx-auto mb-4">
            M
          </div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Iorc Lab</h2>
          <p className="text-[11px] text-slate-400 uppercase tracking-widest mt-1">
            Odontologia Digital
          </p>
        </div>

        {/* Welcome */}
        <div className="text-center mb-6">
          <p className="text-sm text-slate-500">
            Entre com suas credenciais para acessar o painel.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-xs text-center font-medium animate-fade-in">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
              Usuário
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Mail size={15} />
              </span>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu usuário"
                className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all text-xs font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
              Senha
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <KeyRound size={15} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all text-xs font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold rounded-[10px] transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {submitting ? 'Acessando...' : 'Entrar'}
          </button>
        </form>

      </div>
    </div>
  );
};
