import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';

const functions = app ? getFunctions(app, 'us-central1') : null;

export interface Condominio {
  id_condominio_cond: string;
  st_fantasia_cond: string;
  st_nome_cond?: string;
  [key: string]: unknown;
}

export interface Cobranca {
  id_recebimento_recb: string;
  dt_vencimento_recb: string;
  vl_emitido_recb: string;
  st_descricao_recb?: string;
  link_segundavia?: string;
  fl_status_recb?: string;
  statusLabel?: 'pago' | 'vencido' | 'a_vencer' | 'acordo' | 'cancelado' | 'cartorio';
  unitId: string;
  unitLabel: string;
  [key: string]: unknown;
}

export async function setupAmoCondominioConfig(): Promise<{ status: string; docId?: string; configs?: any[] }> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<void, { status: string; docId?: string; configs?: any[] }>(functions, 'setupAmoCondominioConfig');
  const result = await callable();
  return result.data;
}

export async function listCondominios(tenantId?: string): Promise<Condominio[]> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<{ tenantId?: string }, Condominio[]>(functions, 'listCondominios');
  const result = await callable({ tenantId });
  return result.data;
}

export async function searchByCpf(
  idCondominio: string,
  cpf: string,
  status: string = 'pendentes',
  dtInicio?: string,
  dtFim?: string
): Promise<{ units: any[]; cobrancas: Cobranca[]; cpfNotFound?: boolean }> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { idCondominio: string; cpf: string; status: string; dtInicio?: string; dtFim?: string },
    { units: any[]; cobrancas: Cobranca[]; cpfNotFound?: boolean }
  >(functions, 'searchByCpf');
  const payload: { idCondominio: string; cpf: string; status: string; dtInicio?: string; dtFim?: string } = { idCondominio, cpf, status };
  if (dtInicio) payload.dtInicio = dtInicio;
  if (dtFim) payload.dtFim = dtFim;
  const result = await callable(payload);
  return result.data;
}

export async function enrichContactsFromSuperlogica(): Promise<{ enriched: number; notFound: number; total: number }> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<void, { enriched: number; notFound: number; total: number }>(functions, 'enrichContacts');
  const result = await callable();
  return result.data;
}

export async function generateBoletoLink(idCondominio: string, idRecebimento: string, dtVencimento: string): Promise<any> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<{ idCondominio: string; idRecebimento: string; dtVencimento: string }, any>(functions, 'generateBoletoLink');
  const result = await callable({ idCondominio, idRecebimento, dtVencimento });
  return result.data;
}

export async function syncSuperlogicaContacts(): Promise<{ synced: number; created: number; updated: number }> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<void, { synced: number; created: number; updated: number }>(functions, 'syncSuperlogicaContacts', { timeout: 300000 });
  const result = await callable();
  return result.data;
}

export async function migratePhoneFormat(): Promise<{ migrated: number; skipped: number; duplicates: number; total: number }> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<void, { migrated: number; skipped: number; duplicates: number; total: number }>(functions, 'migratePhoneFormat', { timeout: 300000 });
  const result = await callable();
  return result.data;
}

export interface UnidadeSuperlogica {
  id_unidade_uni: string;
  st_unidade_uni: string;
  st_bloco_uni: string;
  st_nome_cond: string;
  id_condominio_cond: string;
  contatos: Array<{
    st_nome_con: string;
    st_celular_con: string;
    st_telefone_con?: string;
    st_email_con?: string;
    st_cpf_con?: string;
  }>;
  celular_proprietario?: string;
  telefone_proprietario?: string;
  nome_proprietario?: string;
}

export async function listUnidades(tenantId?: string): Promise<UnidadeSuperlogica[]> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<{ tenantId?: string }, UnidadeSuperlogica[]>(functions, 'listUnidades', { timeout: 120000 });
  const result = await callable({ tenantId });
  return result.data;
}
