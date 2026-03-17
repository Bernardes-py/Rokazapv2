import * as functions from "firebase-functions";
import fetch from "node-fetch";
import { getSuperlogicaConfig, resolveTenantId, SUPERLOGICA_BASE_URL } from "./superlogicaConfig";

export interface UnidadeResult {
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

/**
 * Lista todas as unidades dos condomínios vinculados ao tenant,
 * incluindo dados dos contatos/moradores.
 */
export const listUnidades = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }

    const overrideTenantId = data?.tenantId;
    const tenantId = await resolveTenantId(context.auth.uid, overrideTenantId);
    
    let config;
    try {
      config = await getSuperlogicaConfig(tenantId);
    } catch (err: any) {
      console.error(`[listUnidades] Config resolution failed for tenant ${tenantId}:`, err);
      throw new functions.https.HttpsError("not-found", `Configuração Superlógica não encontrada para o tenant ${tenantId}.`);
    }

    if (!config.appToken || !config.accessToken) {
      throw new functions.https.HttpsError("not-found", `Credenciais Superlógica ausentes para o tenant ${tenantId}.`);
    }

    console.log(`[listUnidades] tenant: ${tenantId}, condominioIds: ${JSON.stringify(config.condominioIds)}`);

    const headers = {
      "Content-Type": "application/json",
      app_token: config.appToken,
      access_token: config.accessToken,
    };

    // 1) Fetch condominiums
    const condoUrl = `${SUPERLOGICA_BASE_URL}/condominios/get?id=-1&somenteCondominiosAtivos=1&apenasColunasPrincipais=1`;
    const condoResp = await fetch(condoUrl, { method: "GET", headers });
    if (!condoResp.ok) throw new functions.https.HttpsError("internal", `Erro condominios: ${condoResp.status}`);
    let condos: any[] = await condoResp.json();

    // Filter by condominioIds if configured
    if (config.condominioIds && config.condominioIds.length > 0) {
      condos = condos.filter((c: any) =>
        config.condominioIds!.includes(String(c.id_condominio_cond))
      );
    }

    const allUnits: any[] = [];

    for (const condo of condos) {
      const condoId = condo.id_condominio_cond;
      const condoName = condo.st_fantasia_cond || condo.st_nome_cond || condoId;

      let page = 1;
      while (true) {
        const unitsUrl = `${SUPERLOGICA_BASE_URL}/unidades/index?idCondominio=${condoId}&exibirDadosDosContatos=1&pagina=${page}&itensPorPagina=50`;
        const unitsResp = await fetch(unitsUrl, { method: "GET", headers });
        if (!unitsResp.ok) break;
        const units: any[] = await unitsResp.json();
        if (!Array.isArray(units) || units.length === 0) break;

        for (const unit of units) {
          allUnits.push({
            ...unit,
            st_nome_cond: condoName,
            id_condominio_cond: condoId,
          });
        }

        if (units.length < 50) break;
        page++;
      }
    }

    console.log(`[listUnidades] ${condos.length} condominios, ${allUnits.length} unidades`);
    return allUnits;
  });
