import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Mail, Sparkles } from 'lucide-react';

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

    setSubmitting(true);
    setErrorMsg('');
    try {
      await login(email);
    } catch (err: any) {
      setErrorMsg('Falha na autenticação. Verifique os dados inseridos.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (quickEmail: string) => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      await login(quickEmail);
    } catch (err: any) {
      setErrorMsg('Falha no login rápido.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel rounded-2xl overflow-hidden shadow-2xl relative border border-white/20">
        
        {/* Glow Effects */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-cyan-400 to-sky-500" />
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-cyan-400 flex items-center justify-center text-white text-3xl font-black mx-auto mb-4 shadow-lg shadow-primary/25">
              M
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Iorc Lab</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Odontologia Digital
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-medium animate-fade-in">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Usuário
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                  <Mail size={16} />
                </span>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="matheus, secretaria ou seu usuário"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-white/10 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                  <KeyRound size={16} />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-white/10 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-primary/30 flex items-center justify-center gap-2 glow-btn disabled:opacity-50 mt-6"
            >
              {submitting ? 'Acessando...' : 'Entrar no Sistema'}
            </button>
          </form>

          {/* Quick Logins (Demo/Mock Helper) */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary mb-4 bg-primary/10 px-3 py-1.5 rounded-full w-fit mx-auto">
              <Sparkles size={12} />
              Demonstração / Testes Rápidos
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('matheus')}
                disabled={submitting}
                className="p-2.5 text-[11px] font-semibold rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary transition-all duration-200"
              >
                Dr. Matheus<br/>
                <span className="font-normal text-[9px] text-muted-foreground">(Admin)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('secretaria')}
                disabled={submitting}
                className="p-2.5 text-[11px] font-semibold rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary transition-all duration-200"
              >
                Secretária<br/>
                <span className="font-normal text-[9px] text-muted-foreground">(Secretary)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('allan')}
                disabled={submitting}
                className="p-2.5 text-[11px] font-semibold rounded-xl bg-secondary/60 hover:bg-secondary border border-white/5 text-foreground transition-all duration-200"
              >
                Dr. Allan<br/>
                <span className="font-normal text-[9px] text-muted-foreground">(Dentista)</span>
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground/80 mt-4 leading-normal">
              * O sistema está em modo de simulação (Mock). Digite qualquer e-mail de dentista ou clique em um dos atalhos para testar os perfis.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
