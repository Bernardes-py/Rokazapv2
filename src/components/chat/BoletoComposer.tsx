import { useState, useEffect, useMemo } from 'react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Search, Send, Receipt, AlertCircle, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { listCondominios, searchByCpf, generateBoletoLink, Condominio, Cobranca } from '@/services/superlogicaService';

interface BoletoComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendLink: (message: string, linkUrl: string, title: string, description: string, image: string) => void;
}

export default function BoletoComposer({ open, onOpenChange, onSendLink }: BoletoComposerProps) {
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [loadingCondominios, setLoadingCondominios] = useState(false);
  const [selectedCondominio, setSelectedCondominio] = useState('');
  const [cpf, setCpf] = useState('');
  const [searching, setSearching] = useState(false);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [selectedCobrancas, setSelectedCobrancas] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'pendentes' | 'pagas' | 'todas'>('pendentes');
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(subMonths(new Date(), 3)));
  const [dateTo, setDateTo] = useState<Date>(new Date());

  const showDatePickers = statusFilter === 'pagas' || statusFilter === 'todas';

  // Clear stale error when filter/condominio/cpf changes
  useEffect(() => {
    setError('');
  }, [statusFilter, selectedCondominio, cpf]);

  useEffect(() => {
    if (open && condominios.length === 0) {
      loadCondominios();
    }
  }, [open]);

  const loadCondominios = async () => {
    setLoadingCondominios(true);
    setError('');
    try {
      const data = await listCondominios();
      setCondominios(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[BoletoComposer] Erro ao listar condomínios:', err);
      setError(err?.message || 'Erro ao carregar condomínios');
    } finally {
      setLoadingCondominios(false);
    }
  };

  const handleSearch = async () => {
    if (!selectedCondominio || !cpf.trim()) return;
    setSearching(true);
    setError('');
    setCobrancas([]);
    setSelectedCobrancas(new Set());
    setSearched(true);
    const requestStatus = statusFilter;
    // Format dates as MM/DD/YYYY for the API
    const dtInicio = showDatePickers ? format(dateFrom, 'MM/dd/yyyy') : undefined;
    const dtFim = showDatePickers ? format(dateTo, 'MM/dd/yyyy') : undefined;
    try {
      const result = await searchByCpf(selectedCondominio, cpf.trim(), requestStatus, dtInicio, dtFim);
      console.log('[BoletoComposer] searchByCpf result:', JSON.stringify({
        units: (result.units || []).length,
        cobrancas: (result.cobrancas || []).length,
        cpfNotFound: result.cpfNotFound,
        firstCharge: (result.cobrancas || [])[0] ? {
          id: result.cobrancas[0].id_recebimento_recb,
          vencimento: result.cobrancas[0].dt_vencimento_recb,
          valor: result.cobrancas[0].vl_emitido_recb,
          status: (result.cobrancas[0] as any).fl_status_recb || (result.cobrancas[0] as any).st_status_recb,
        } : null,
      }, null, 2));
      setCobrancas(result.cobrancas || []);
      if ((result.cobrancas || []).length === 0) {
        if (result.cpfNotFound) {
          setError('CPF não localizado nas unidades deste condomínio. Verifique se o CPF e o condomínio estão corretos.');
        } else {
          const filterLabel = requestStatus === 'pendentes' ? 'em aberto' : requestStatus === 'pagas' ? 'pago' : '';
          setError(`CPF localizado, mas nenhum boleto ${filterLabel} encontrado.`.trim());
        }
      }
    } catch (err: any) {
      console.error('[BoletoComposer] Erro ao buscar cobranças:', err);
      setError(err?.message || 'Erro ao buscar cobranças');
    } finally {
      setSearching(false);
    }
  };

  const toggleCobranca = (id: string) => {
    setSelectedCobrancas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatVencimento = (raw: string): string => {
    return (raw || '').split(' ')[0];
  };

  const handleSend = async () => {
    if (selectedCobrancas.size === 0) return;
    setSending(true);
    setError('');

    try {
      for (const cobId of selectedCobrancas) {
        const cob = cobrancas.find(c => c.id_recebimento_recb === cobId);
        if (!cob) continue;

        // Use link_segundavia already returned by searchByCpf
        const linkUrl = (cob as any).link_segundavia || '';

        if (!linkUrl) {
          setError('Não foi possível gerar o link da 2ª via.');
          continue;
        }

        const condName = condominios.find(c => c.id_condominio_cond === selectedCondominio)?.st_fantasia_cond || 'Condomínio';
        const valor = parseFloat(cob.vl_emitido_recb || '0').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const vencimentoFormatado = formatVencimento(cob.dt_vencimento_recb);
        const title = `2ª Via de Boleto - ${condName}`;
        const description = `Vencimento: ${vencimentoFormatado} | Valor: ${valor}`;

        onSendLink(
          `Segue o link da 2ª via do boleto:\n${title}\n${description}`,
          linkUrl,
          title,
          description,
          ''
        );
      }

      // Reset and close
      resetState();
      onOpenChange(false);
    } catch (err: any) {
      console.error('[BoletoComposer] Erro ao gerar link:', err);
      setError(err?.message || 'Erro ao gerar link do boleto');
    } finally {
      setSending(false);
    }
  };

  const resetState = () => {
    setSelectedCondominio('');
    setCpf('');
    setCobrancas([]);
    setSelectedCobrancas(new Set());
    setError('');
    setSearched(false);
    setStatusFilter('pendentes');
    setDateFrom(startOfMonth(subMonths(new Date(), 3)));
    setDateTo(new Date());
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            2ª Via de Boleto
          </DialogTitle>
          <DialogDescription>
            Selecione o condomínio e informe o CPF para buscar boletos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Condomínio select */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Condomínio</label>
            {loadingCondominios ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando condomínios...
              </div>
            ) : (
              <Select value={selectedCondominio} onValueChange={setSelectedCondominio}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o condomínio" />
                </SelectTrigger>
                <SelectContent>
                  {condominios.map((c) => (
                    <SelectItem key={c.id_condominio_cond} value={c.id_condominio_cond}>
                      {c.st_fantasia_cond || c.st_nome_cond || `Cond. ${c.id_condominio_cond}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Status filter */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">O que deseja ver?</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'pendentes' | 'pagas' | 'todas')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendentes">Em aberto</SelectItem>
                <SelectItem value="pagas">Já pagos</SelectItem>
                <SelectItem value="todas">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date range pickers — conditional */}
          {showDatePickers && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Período</label>
              <div className="flex gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "De"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(d) => d && setDateFrom(d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-sm text-muted-foreground">até</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Até"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(d) => d && setDateTo(d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* CPF input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">CPF</label>
            <div className="flex gap-2">
              <Input
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              />
              <Button
                onClick={handleSearch}
                disabled={!selectedCondominio || cpf.replace(/\D/g, '').length < 11 || searching}
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Cobranças list */}
          {cobrancas.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  {statusFilter === 'pendentes' ? 'Boletos em aberto' : statusFilter === 'pagas' ? 'Boletos pagos' : 'Boletos encontrados'} ({cobrancas.length})
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    if (selectedCobrancas.size === cobrancas.length) {
                      setSelectedCobrancas(new Set());
                    } else {
                      setSelectedCobrancas(new Set(cobrancas.map(c => c.id_recebimento_recb)));
                    }
                  }}
                >
                  {selectedCobrancas.size === cobrancas.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </Button>
              </div>
              <ScrollArea className="max-h-72">
                <div className="space-y-2 pr-3">
                  {cobrancas.map((cob) => {
                    const isSelected = selectedCobrancas.has(cob.id_recebimento_recb);
                    const valor = parseFloat(cob.vl_emitido_recb || '0').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const vencimento = formatVencimento(cob.dt_vencimento_recb);
                    const status = cob.statusLabel || (cob.fl_status_recb === '3' ? 'pago' : cob.fl_status_recb === '4' ? 'acordo' : cob.fl_status_recb === '1' ? 'cancelado' : cob.fl_status_recb === '2' ? 'cartorio' : 'a_vencer');
                    const statusConfig: Record<string, { label: string; color: string }> = {
                      pago: { label: 'Pago', color: 'bg-green-100 text-green-800 border-green-200' },
                      vencido: { label: 'Atrasado', color: 'bg-red-100 text-red-800 border-red-200' },
                      a_vencer: { label: 'A vencer', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
                      acordo: { label: 'Em acordo', color: 'bg-blue-100 text-blue-800 border-blue-200' },
                      cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-600 border-gray-200' },
                      cartorio: { label: 'Cartório', color: 'bg-gray-100 text-gray-600 border-gray-200' },
                    };
                    const badge = statusConfig[status] || statusConfig.a_vencer;
                    return (
                      <button
                        key={cob.id_recebimento_recb}
                        onClick={() => toggleCobranca(cob.id_recebimento_recb)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{cob.unitLabel}</p>
                              <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold ${badge.color}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {cob.st_descricao_recb || `Cobrança #${cob.id_recebimento_recb}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-foreground">{valor}</p>
                            <p className="text-xs text-muted-foreground">{vencimento}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Send button */}
          {cobrancas.length > 0 && (
            <Button
              className="w-full"
              onClick={handleSend}
              disabled={selectedCobrancas.size === 0 || sending}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Link ({selectedCobrancas.size})
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
