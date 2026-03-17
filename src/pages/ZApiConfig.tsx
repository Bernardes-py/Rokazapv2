import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, ArrowLeft, Loader2, Eye, EyeOff, CheckCircle, XCircle, Wifi, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isFirebaseConfigured } from '@/lib/firebase';
import { testZApiConnection } from '@/services/zapiService';
import MobileRegistrationWizard from '@/components/MobileRegistrationWizard';

export default function ZApiConfig() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [showToken, setShowToken] = useState(false);
  const [showClientToken, setShowClientToken] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [config, setConfig] = useState({
    apiUrl: 'https://api.z-api.io',
    instanceId: '',
    instanceToken: '',
    clientToken: '',
  });

  // Carregar config existente do Firestore
  useEffect(() => {
    async function loadConfig() {
      if (!db || !user) return;
      try {
        const docSnap = await getDoc(doc(db, 'zapi_config', user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setConfig({
            apiUrl: data.apiUrl || 'https://api.z-api.io',
            instanceId: data.instanceId || '',
            instanceToken: data.instanceToken || '',
            clientToken: data.clientToken || '',
          });
        }
      } catch (err) {
        console.error('Erro ao carregar config:', err);
      }
    }
    loadConfig();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isFirebaseConfigured() && db && user) {
        await setDoc(doc(db, 'zapi_config', user.uid), {
          ...config,
          ownerId: user.uid,
        });
      } else {
        localStorage.setItem('zapi_config', JSON.stringify(config));
      }
      toast({ title: 'Configuração salva com sucesso!' });
      navigate('/');
    } catch {
      toast({ title: 'Erro ao salvar configuração', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('idle');
    try {
      const result = await testZApiConnection();
      if (result.connected) {
        setConnectionStatus('connected');
        toast({ title: `Conectado! Número: ${result.phone || 'OK'}` });
      } else {
        setConnectionStatus('error');
        toast({ title: 'Instância não conectada', description: result.error, variant: 'destructive' });
      }
    } catch (err) {
      setConnectionStatus('error');
      toast({ title: 'Erro ao testar conexão', description: 'Verifique se as Cloud Functions estão deployadas.', variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-whatsapp-green">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Configuração Z-API</CardTitle>
              <CardDescription>Configure as credenciais da sua instância Z-API</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">URL da API</Label>
              <Input id="apiUrl" value={config.apiUrl} onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })} placeholder="https://api.z-api.io" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instanceId">ID da Instância</Label>
              <Input id="instanceId" value={config.instanceId} onChange={(e) => setConfig({ ...config, instanceId: e.target.value })} placeholder="Seu ID da instância" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instanceToken">Token da Instância</Label>
              <div className="relative">
                <Input id="instanceToken" type={showToken ? 'text' : 'password'} value={config.instanceToken} onChange={(e) => setConfig({ ...config, instanceToken: e.target.value })} placeholder="Seu token da instância" required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowToken(!showToken)}>
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientToken">Client Token</Label>
              <div className="relative">
                <Input id="clientToken" type={showClientToken ? 'text' : 'password'} value={config.clientToken} onChange={(e) => setConfig({ ...config, clientToken: e.target.value })} placeholder="Seu client token" required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowClientToken(!showClientToken)}>
                  {showClientToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 bg-whatsapp-green hover:bg-whatsapp-green/90" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Configuração
              </Button>
              <Button type="button" variant="outline" onClick={handleTestConnection} disabled={isTesting || !config.instanceId}>
                {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                  connectionStatus === 'connected' ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> :
                  connectionStatus === 'error' ? <XCircle className="mr-2 h-4 w-4 text-red-500" /> :
                  <Wifi className="mr-2 h-4 w-4" />
                }
                Testar
              </Button>
              <Button type="button" variant="outline" onClick={() => signOut()}>Sair</Button>
            </div>
          </form>

          {/* Botão Registrar Número */}
          <div className="mt-4">
            <Button variant="outline" className="w-full" onClick={() => setWizardOpen(true)}>
              <Smartphone className="mr-2 h-4 w-4" />
              Registrar Número Mobile
            </Button>
          </div>

          <MobileRegistrationWizard open={wizardOpen} onOpenChange={setWizardOpen} />

          {/* Instruções de Deploy */}
          <div className="mt-6 rounded-lg border border-whatsapp-border bg-muted/50 p-4 text-sm space-y-2">
            <h3 className="font-semibold text-foreground">📋 Deploy das Cloud Functions</h3>
            <p className="text-muted-foreground">Para enviar/receber mensagens, faça o deploy das Cloud Functions:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li><code className="bg-muted px-1 rounded">npm install -g firebase-tools</code></li>
              <li><code className="bg-muted px-1 rounded">cd functions && npm install</code></li>
              <li><code className="bg-muted px-1 rounded">firebase deploy --only functions</code></li>
            </ol>

            <h3 className="font-semibold text-foreground mt-4">🔗 Configuração no Painel Z-API</h3>
            <p className="text-muted-foreground">No painel da Z-API, configure estas URLs:</p>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Ao receber (mensagens):</strong><br />
                <code className="bg-muted px-1 rounded text-xs break-all">https://us-central1-rokazap.cloudfunctions.net/zapiWebhook</code>
              </li>
              <li>
                <strong className="text-foreground">Status da mensagem (✓✓ lido):</strong><br />
                <code className="bg-muted px-1 rounded text-xs break-all">https://us-central1-rokazap.cloudfunctions.net/zapiStatusWebhook</code>
              </li>
              <li>
                <strong className="text-foreground">Presença no chat (digitando, online):</strong><br />
                <code className="bg-muted px-1 rounded text-xs break-all">https://us-central1-rokazap.cloudfunctions.net/zapiPresenceWebhook</code>
              </li>
              <li>
                <strong className="text-foreground">Ao enviar:</strong> deixe <em>vazio</em>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground/70 mt-2">
              ⚠️ <code>sendMessage</code> é uma função interna do app — <strong>não</strong> use como URL de webhook.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
