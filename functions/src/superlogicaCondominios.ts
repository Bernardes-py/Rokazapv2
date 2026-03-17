import * as functions from "firebase-functions";
import fetch from "node-fetch";
import { getSuperlogicaConfig, resolveTenantId, SUPERLOGICA_BASE_URL } from "./superlogicaConfig";

export const listCondominios = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const overrideTenantId = data?.tenantId;
  const tenantId = await resolveTenantId(context.auth.uid, overrideTenantId);
  
  let config;
  try {
    config = await getSuperlogicaConfig(tenantId);
  } catch (err: any) {
    console.error(`[listCondominios] Config resolution failed for tenant ${tenantId}:`, err);
    throw new functions.https.HttpsError("not-found", `Configuração Superlógica não encontrada para o tenant ${tenantId}. Vincule as credenciais primeiro.`);
  }

  if (!config.appToken || !config.accessToken) {
    throw new functions.https.HttpsError("not-found", `Credenciais Superlógica ausentes para o tenant ${tenantId}.`);
  }

  console.log(`[listCondominios] tenant: ${tenantId}`);

  const url = `${SUPERLOGICA_BASE_URL}/condominios/get?id=-1&somenteCondominiosAtivos=1&apenasColunasPrincipais=1`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "app_token": config.appToken,
      "access_token": config.accessToken,
    },
  });

  if (!response.ok) {
    throw new functions.https.HttpsError("internal", `Superlogica API error: ${response.status}`);
  }

  let condominios: any[] = await response.json();

  // Filter by condominioIds if configured
  if (config.condominioIds && config.condominioIds.length > 0) {
    condominios = condominios.filter((c: any) =>
      config.condominioIds!.includes(String(c.id_condominio_cond))
    );
    console.log(`[listCondominios] filtered to ${condominios.length} condominios`);
  }

  return condominios;
});
