import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Loader2, Download, Building2, ChevronLeft } from 'lucide-react';
import { listCondominios, listUnidades, setupAmoCondominioConfig, Condominio, UnidadeSuperlogica } from '@/services/superlogicaService';
import { useTenant } from '@/contexts/TenantContext';

const LOPES_X_ID = '5GlQDHGt7tNqFYnQtg0V';
const AMO_TENANT_ID = 'AyGEjmRvU1bQiKQruiiE';

const API_OPTIONS = [
  { id: '5GlQDHGt7tNqFYnQtg0V', label: 'Lopes X', description: 'Condomínios da Lopes X' },
  { id: AMO_TENANT_ID, label: 'Amo Condomínio', description: 'Condomínios da Amo Condomínio' },
];

interface DownloadContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (units: UnidadeSuperlogica[], onProgress?: (pct: number) => void) => Promise<void>;
}

export default function DownloadContactsDialog({ open, onOpenChange, onImport }: DownloadContactsDialogProps) {
  const { tenantId } = useTenant();
  const isAutoImport = tenantId === AMO_TENANT_ID;
  const autoImportTriggered = useRef(false);

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedApi, setSelectedApi] = useState<string | null>(null);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [selectedCondominios, setSelectedCondominios] = useState<Set<string>>(new Set());
  const [loadingCondominios, setLoadingCondominios] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const reset = () => {
    setStep(1);
    setSelectedApi(null);
    setCondominios([]);
    setSelectedCondominios(new Set());
    setError(null);
    setImporting(false);
    setLoadingCondominios(false);
    setProgress(0);
    autoImportTriggered.current = false;
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // Auto-import for non-Lopes X tenants
  useEffect(() => {
    if (!open || !isAutoImport || !tenantId || autoImportTriggered.current) return;
    autoImportTriggered.current = true;

    const doAutoImport = async () => {
      setImporting(true);
      setProgress(0);
      setError(null);
      try {
        if (tenantId === AMO_TENANT_ID) {
          const setupResult = await setupAmoCondominioConfig();
          if (setupResult.status === 'not_found') {
            setError('Configuração da Amo Condomínio não encontrada. As credenciais precisam ser vinculadas manualmente.');
            setImporting(false);
            return;
          }
        }
        const units = await listUnidades(tenantId);
        await onImport(units, (pct) => setProgress(pct));
        handleClose(false);
      } catch (err: any) {
        setError(err?.message || 'Erro ao importar contatos');
      } finally {
        setImporting(false);
      }
    };

    doAutoImport();
  }, [open, tenantId, isAutoImport]);

  const handleSelectApi = async (apiId: string) => {
    setSelectedApi(apiId);
    setError(null);
    setLoadingCondominios(true);
    try {
      if (apiId === AMO_TENANT_ID) {
        const setupResult = await setupAmoCondominioConfig();
        if (setupResult.status === 'not_found') {
          setError('Configuração da Amo Condomínio não encontrada no Firestore. As credenciais precisam ser vinculadas manualmente antes de importar.');
          setLoadingCondominios(false);
          return;
        }
      }
      const result = await listCondominios(apiId);
      setCondominios(result);
      setSelectedCondominios(new Set(result.map(c => c.id_condominio_cond)));
      setStep(2);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('not-found') || msg.includes('não encontrada')) {
        setError('Credenciais Superlógica não configuradas para este tenant. Vincule as credenciais no Firestore primeiro.');
      } else {
        setError(msg || 'Erro ao carregar condomínios');
      }
    } finally {
      setLoadingCondominios(false);
    }
  };

  const toggleCondominio = (id: string) => {
    setSelectedCondominios(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCondominios.size === condominios.length) {
      setSelectedCondominios(new Set());
    } else {
      setSelectedCondominios(new Set(condominios.map(c => c.id_condominio_cond)));
    }
  };

  const doImport = async (apiId?: string) => {
    const tid = apiId || selectedApi;
    if (!tid) return;
    setImporting(true);
    setProgress(0);
    setError(null);
    try {
      const units = await listUnidades(tid);
      const filtered = condominios.length > 1
        ? units.filter(u => selectedCondominios.has(u.id_condominio_cond))
        : units;
      await onImport(filtered, (pct) => setProgress(pct));
      handleClose(false);
    } catch (err: any) {
      setError(err?.message || 'Erro ao importar contatos');
    } finally {
      setImporting(false);
    }
  };

  // Non-Lopes X: simplified dialog (loading or error only)
  if (isAutoImport) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download Contatos
            </DialogTitle>
            <DialogDescription>Importando contatos da Superlógica</DialogDescription>
          </DialogHeader>

          {importing ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="w-full max-w-xs space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">{progress}% concluído</p>
              </div>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <p className="text-sm text-destructive">{error}</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleClose(false)}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    );
  }

  // Lopes X: full manual flow
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Contatos
          </DialogTitle>
          <DialogDescription>Importe contatos da Superlógica para o CRM</DialogDescription>
        </DialogHeader>

        {loadingCondominios || importing ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {importing ? (
              <div className="w-full max-w-xs space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">{progress}% concluído</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Carregando condomínios...</p>
            )}
          </div>
        ) : step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Escolha a API de onde deseja importar os contatos:</p>
            <div className="space-y-2">
              {API_OPTIONS.map(api => (
                <Button
                  key={api.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => handleSelectApi(api.id)}
                >
                  <Building2 className="h-5 w-5 mr-3 text-primary shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">{api.label}</div>
                    <div className="text-xs text-muted-foreground">{api.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setStep(1); setSelectedApi(null); }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm text-muted-foreground">
                Selecione os condomínios para importar ({selectedCondominios.size}/{condominios.length}):
              </p>
            </div>
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                checked={selectedCondominios.size === condominios.length}
                onCheckedChange={toggleAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Selecionar Todos
              </label>
            </div>
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-2 space-y-1">
                {condominios.map(c => (
                  <label
                    key={c.id_condominio_cond}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedCondominios.has(c.id_condominio_cond)}
                      onCheckedChange={() => toggleCondominio(c.id_condominio_cond)}
                    />
                    <span className="text-sm">{c.st_fantasia_cond || c.st_nome_cond || c.id_condominio_cond}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {step === 2 && !loadingCondominios && !importing && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
            <Button onClick={() => doImport()} disabled={selectedCondominios.size === 0}>
              Importar {selectedCondominios.size} condomínio{selectedCondominios.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
