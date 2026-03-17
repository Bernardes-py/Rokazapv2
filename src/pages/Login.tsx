import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import sindicoLogo from '@/assets/sindico-x-logo-white.jpg';

export default function Login() {
  const { signInWithPassword } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithPassword(email, password);
      toast({ title: 'Login realizado com sucesso!' });
    } catch (err: any) {
      const msg = err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
        ? 'Email ou senha incorretos'
        : err?.code === 'auth/user-not-found'
        ? 'Usuário não encontrado'
        : `Erro: ${err?.message || 'Tente novamente.'}`;
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, hsl(215 80% 8%) 0%, hsl(215 70% 15%) 50%, hsl(215 60% 20%) 100%)',
      }}
    >
      {/* Subtle decorative circles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, hsl(217 91% 60%), transparent 70%)' }} />
        <div className="absolute -bottom-48 -left-48 h-[500px] w-[500px] rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, hsl(217 91% 60%), transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border p-8 backdrop-blur-sm"
          style={{
            background: 'linear-gradient(145deg, hsl(215 60% 14% / 0.9), hsl(215 70% 10% / 0.95))',
            borderColor: 'hsl(215 50% 25% / 0.5)',
            boxShadow: '0 25px 60px -12px hsl(215 80% 5% / 0.7), 0 0 40px -8px hsl(217 91% 60% / 0.1)',
          }}
        >
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <img
              src={sindicoLogo}
              alt="Síndico X"
              className="h-14 w-auto object-contain"
              style={{ filter: 'invert(1)', mixBlendMode: 'screen' }}
            />
          </div>

          {/* Subtitle */}
          <p className="mb-8 text-center text-sm tracking-wide"
            style={{ color: 'hsl(215 30% 55%)' }}>
            Acesse sua conta
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wider"
                style={{ color: 'hsl(215 30% 55%)' }}>
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: 'hsl(215 30% 45%)' }} />
                <input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 w-full rounded-xl pl-10 pr-4 text-sm outline-none transition-all duration-200 placeholder:text-[hsl(215_30%_40%)] focus:ring-2"
                  style={{
                    background: 'hsl(215 60% 12%)',
                    border: '1px solid hsl(215 50% 25% / 0.5)',
                    color: 'hsl(0 0% 92%)',
                    boxShadow: 'inset 0 2px 4px hsl(215 80% 5% / 0.3)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'hsl(217 91% 60%)';
                    e.target.style.boxShadow = 'inset 0 2px 4px hsl(215 80% 5% / 0.3), 0 0 0 3px hsl(217 91% 60% / 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'hsl(215 50% 25% / 0.5)';
                    e.target.style.boxShadow = 'inset 0 2px 4px hsl(215 80% 5% / 0.3)';
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-medium uppercase tracking-wider"
                style={{ color: 'hsl(215 30% 55%)' }}>
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: 'hsl(215 30% 45%)' }} />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 w-full rounded-xl pl-10 pr-4 text-sm outline-none transition-all duration-200 placeholder:text-[hsl(215_30%_40%)] focus:ring-2"
                  style={{
                    background: 'hsl(215 60% 12%)',
                    border: '1px solid hsl(215 50% 25% / 0.5)',
                    color: 'hsl(0 0% 92%)',
                    boxShadow: 'inset 0 2px 4px hsl(215 80% 5% / 0.3)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'hsl(217 91% 60%)';
                    e.target.style.boxShadow = 'inset 0 2px 4px hsl(215 80% 5% / 0.3), 0 0 0 3px hsl(217 91% 60% / 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'hsl(215 50% 25% / 0.5)';
                    e.target.style.boxShadow = 'inset 0 2px 4px hsl(215 80% 5% / 0.3)';
                  }}
                />
              </div>
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold tracking-wide text-white transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, hsl(217 91% 55%), hsl(217 91% 65%))',
                boxShadow: '0 4px 15px hsl(217 91% 50% / 0.4)',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  (e.target as HTMLButtonElement).style.boxShadow = '0 6px 20px hsl(217 91% 50% / 0.6)';
                  (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.boxShadow = '0 4px 15px hsl(217 91% 50% / 0.4)';
                (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Entrar
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs"
          style={{ color: 'hsl(215 30% 35%)' }}>
          © Síndico X 2026
        </p>
      </div>
    </div>
  );
}
