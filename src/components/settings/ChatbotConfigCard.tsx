import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Bot, Clock, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface Schedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface ChatbotConfig {
  enabled: boolean;
  openaiApiKey: string;
  systemPrompt: string;
  absenceMessage: string;
  replyMode: 'always' | 'outside_hours';
  schedule: Schedule;
  timezone: string;
}

const DAY_LABELS: Record<keyof Schedule, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const HOURS = Array.from({ length: 25 }, (_, i) => {
  const h = String(Math.floor(i)).padStart(2, '0');
  return `${h}:00`;
});
// Add half hours
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}
TIME_OPTIONS.push('23:59');

const defaultSchedule: Schedule = {
  monday: { enabled: true, start: '08:00', end: '18:00' },
  tuesday: { enabled: true, start: '08:00', end: '18:00' },
  wednesday: { enabled: true, start: '08:00', end: '18:00' },
  thursday: { enabled: true, start: '08:00', end: '18:00' },
  friday: { enabled: true, start: '08:00', end: '18:00' },
  saturday: { enabled: false, start: '08:00', end: '12:00' },
  sunday: { enabled: false, start: '', end: '' },
};

const defaultConfig: ChatbotConfig = {
  enabled: false,
  openaiApiKey: '',
  systemPrompt: 'Você é o assistente virtual do Síndico X. Responda de forma educada e objetiva. Se não souber a resposta, informe que um atendente entrará em contato no próximo horário de funcionamento.',
  absenceMessage: '👋 Olá! No momento estamos fora do horário de atendimento. O Síndico X estará disponível no próximo dia útil. Se precisar, deixe sua mensagem que responderemos assim que possível!',
  replyMode: 'always',
  schedule: defaultSchedule,
  timezone: 'America/Sao_Paulo',
};

export default function ChatbotConfigCard() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<ChatbotConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appUser?.uid) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db!, 'chatbot_config', appUser.uid));
        if (snap.exists()) {
          const data = snap.data() as Partial<ChatbotConfig>;
          setConfig({ ...defaultConfig, ...data, schedule: { ...defaultSchedule, ...data.schedule } });
        }
      } catch (err) {
        console.error('Erro ao carregar config chatbot:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [appUser?.uid]);

  const handleSave = async () => {
    if (!appUser?.uid) return;
    setSaving(true);
    try {
      await setDoc(doc(db!, 'chatbot_config', appUser.uid), {
        ...config,
        ownerId: appUser.uid,
        tenantId: appUser.tenantId || '',
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Configuração salva!' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (day: keyof Schedule, field: keyof DaySchedule, value: any) => {
    setConfig(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: { ...prev.schedule[day], [field]: value },
      },
    }));
  };

  if (loading) {
    return (
      <Card className="border-border/40">
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="h-5 w-5" /> ChatBot & Horário de Funcionamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Ativar ChatBot</Label>
            <p className="text-xs text-muted-foreground">Resposta automática fora do horário de funcionamento</p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => setConfig(prev => ({ ...prev, enabled: v }))}
          />
        </div>

        {/* Reply Mode */}
        <div className="space-y-2">
          <Label className="text-sm">Modo de resposta da IA</Label>
          <Select
            value={config.replyMode}
            onValueChange={(v) => setConfig(prev => ({ ...prev, replyMode: v as 'always' | 'outside_hours' }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always">Sempre responder</SelectItem>
              <SelectItem value="outside_hours">Só fora do horário de funcionamento</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Escolha se a IA responde sempre ou apenas fora do horário configurado abaixo</p>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label className="text-sm">Chave API do OpenAI</Label>
          <Input
            type="password"
            value={config.openaiApiKey}
            onChange={(e) => setConfig(prev => ({ ...prev, openaiApiKey: e.target.value }))}
            placeholder="sk-..."
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">Sua chave da API do ChatGPT. Encontre em platform.openai.com</p>
        </div>

        {/* System Prompt */}
        <div className="space-y-2">
          <Label className="text-sm">Instruções do ChatGPT (System Prompt)</Label>
          <Textarea
            value={config.systemPrompt}
            onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
            placeholder="Descreva como o ChatGPT deve se comportar..."
            rows={3}
          />
        </div>

        {/* Absence Message */}
        <div className="space-y-2">
          <Label className="text-sm">Mensagem de Ausência</Label>
          <Textarea
            value={config.absenceMessage}
            onChange={(e) => setConfig(prev => ({ ...prev, absenceMessage: e.target.value }))}
            placeholder="Mensagem enviada quando ChatGPT não está configurado..."
            rows={2}
          />
          <p className="text-xs text-muted-foreground">Enviada quando o ChatGPT não tem API Key ou está desativado</p>
        </div>

        {/* Schedule */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Horário de Funcionamento</Label>
          </div>
          <div className="space-y-2">
            {(Object.keys(DAY_LABELS) as Array<keyof Schedule>).map((day) => (
              <div key={day} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-28">
                  <Checkbox
                    checked={config.schedule[day].enabled}
                    onCheckedChange={(v) => updateDay(day, 'enabled', !!v)}
                  />
                  <span className="text-sm">{DAY_LABELS[day]}</span>
                </div>
                {config.schedule[day].enabled ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={config.schedule[day].start}
                      onValueChange={(v) => updateDay(day, 'start', v)}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">até</span>
                    <Select
                      value={config.schedule[day].end}
                      onValueChange={(v) => updateDay(day, 'end', v)}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Fechado</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-green))]/90"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar Configuração
        </Button>
      </CardContent>
    </Card>
  );
}
