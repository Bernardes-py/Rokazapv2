// Deploy trigger: 2026-03-09T12:00Z — tenant-aware + CPF fallback search
import * as functions from "firebase-functions";
import fetch from "node-fetch";
import { getSuperlogicaConfig, resolveTenantId, SUPERLOGICA_BASE_URL } from "./superlogicaConfig";

const STATUS_MAP: Record<string, string> = {
  pendentes: "pendentes",
  pagas: "liquidadas",
  todas: "validos",
};

function toddmmyyyy(raw: string): string {
  const d = (raw || "").split(" ")[0];
  if (d.includes("/")) {
    const [mm, dd, yyyy] = d.split("/");
    if (yyyy && yyyy.length === 4) return `${dd}/${mm}/${yyyy}`;
  }
  return d;
}

function normalize(val: unknown): string {
  return String(val ?? "").trim().replace(/^0+/, "") || "0";
}

function maskCpf(cpf: string): string {
  if (cpf.length >= 3) return `***.***.***-${cpf.slice(-2)}`;
  return "***";
}

export const searchByCpf = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { idCondominio, cpf, status, tenantId: overrideTenantId, dtInicio: customDtInicio, dtFim: customDtFim } = data;
  if (!idCondominio || !cpf) {
    throw new functions.https.HttpsError("invalid-argument", "idCondominio e cpf são obrigatórios");
  }

  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length < 11) {
    throw new functions.https.HttpsError("invalid-argument", "CPF inválido");
  }

  const statusKey = (status as string) || "pendentes";
  const apiStatus = STATUS_MAP[statusKey] || statusKey;

  // Resolve tenant
  const tenantId = await resolveTenantId(context.auth.uid, overrideTenantId);
  const config = await getSuperlogicaConfig(tenantId);

  console.log(`[searchByCpf] tenant: ${tenantId}, cpf: ${maskCpf(cleanCpf)}, cond: ${idCondominio}, status: ${statusKey} -> ${apiStatus}`);

  const headers = {
    "Content-Type": "application/json",
    app_token: config.appToken,
    access_token: config.accessToken,
  };

  // Step 1: Fast path — search units by CPF
  const unitsUrl = `${SUPERLOGICA_BASE_URL}/unidades/index?idCondominio=${idCondominio}&pesquisa=${cleanCpf}&exibirDadosDosContatos=1`;
  console.log("[searchByCpf] fast path:", unitsUrl);
  const unitsRes = await fetch(unitsUrl, { method: "GET", headers });

  if (!unitsRes.ok) {
    throw new functions.https.HttpsError("internal", `Erro ao buscar unidades: ${unitsRes.status}`);
  }

  let units: any[] = await unitsRes.json();
  if (!Array.isArray(units)) units = [];
  console.log(`[searchByCpf] fast path units: ${units.length}`);

  // Step 1b: Fallback — paginated scan if fast path returned empty
  if (units.length === 0) {
    console.log("[searchByCpf] fast path empty, starting fallback scan...");
    units = await fallbackUnitSearch(idCondominio, cleanCpf, headers);
    console.log(`[searchByCpf] fallback units: ${units.length}`);
  }

  if (units.length === 0) {
    console.log("[searchByCpf] no units found after fallback");
    return { units: [], cobrancas: [], cpfNotFound: true };
  }

  // Collect unit IDs
  const unitIds: string[] = [];
  for (const unit of units) {
    const id = normalize(unit.id_unidade_uni);
    if (id !== "0" && !unitIds.includes(id)) unitIds.push(id);
  }
  console.log("[searchByCpf] unitIds:", unitIds);

  if (unitIds.length === 0) {
    return { units, cobrancas: [], cpfNotFound: false };
  }

  // Step 2: Fetch charges per unit with pagination
  const now = new Date();
  let dtInicioStr: string;
  let dtFimStr: string;
  const hasCustomDates = !!(customDtInicio && customDtFim);

  if (hasCustomDates) {
    // Use custom dates provided by the frontend (already in MM/DD/YYYY format)
    dtInicioStr = customDtInicio;
    dtFimStr = customDtFim;
  } else {
    // Default: 5 months back → end of current year
    const fiveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    dtInicioStr = `${String(fiveMonthsAgo.getMonth() + 1).padStart(2, "0")}/01/${fiveMonthsAgo.getFullYear()}`;
    dtFimStr = `12/31/${now.getFullYear()}`;
  }

  const dtInicio = encodeURIComponent(dtInicioStr);
  const dtFim = encodeURIComponent(dtFimStr);
  console.log(`[searchByCpf] dtInicio=${dtInicioStr}, dtFim=${dtFimStr}, customDates=${hasCustomDates}`);
  const allCharges: any[] = [];

  for (const unitId of unitIds) {
    let pagina = 1;
    let hasMore = true;

    while (hasMore) {
      const cobUrl = `${SUPERLOGICA_BASE_URL}/cobranca/index?idCondominio=${idCondominio}&status=${apiStatus}&UNIDADES[0]=${unitId}&dtInicio=${dtInicio}&dtFim=${dtFim}&filtrarpor=vencimento&comDadosDasUnidades=1&apenasColunasPrincipais=1&itensPorPagina=50&pagina=${pagina}`;
      const cobRes = await fetch(cobUrl, { method: "GET", headers });

      if (!cobRes.ok) {
        console.error("[searchByCpf] charge fetch error:", cobRes.status);
        break;
      }

      const page: any = await cobRes.json();
      if (!Array.isArray(page) || page.length === 0) {
        hasMore = false;
      } else {
        const matchedUnit = units.find((u: any) => normalize(u.id_unidade_uni) === unitId);
        for (const cob of page) {
          cob.unitId = unitId;
          cob.unitLabel = matchedUnit?.st_fantasia_uni || matchedUnit?.st_unidade_uni || `Unidade ${unitId}`;
        }
        allCharges.push(...page);
        hasMore = page.length >= 50;
        pagina++;
      }
    }
  }

  console.log("[searchByCpf] total charges fetched:", allCharges.length);

  // Step 3: Deduplicate
  const seen = new Set<string>();
  const cobrancas = allCharges.filter((cob: any) => {
    const id = cob.id_recebimento_recb;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log("[searchByCpf] deduped:", cobrancas.length);

  // Limit paid boletos to last 5 only when using default dates
  if (statusKey === "pagas" && !hasCustomDates) {
    cobrancas.sort((a: any, b: any) => {
      const da = new Date(a.dt_vencimento_recb || "");
      const db = new Date(b.dt_vencimento_recb || "");
      return db.getTime() - da.getTime();
    });
    cobrancas.splice(5);
  }

  // Convert dates to DD/MM/YYYY and compute statusLabel
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  for (const cob of cobrancas) {
    // Compute statusLabel before date formatting
    const rawStatus = String(cob.fl_status_recb ?? "0");
    if (rawStatus === "3") {
      cob.statusLabel = "pago";
    } else if (rawStatus === "4") {
      cob.statusLabel = "acordo";
    } else if (rawStatus === "1") {
      cob.statusLabel = "cancelado";
    } else if (rawStatus === "2") {
      cob.statusLabel = "cartorio";
    } else {
      // status 0 — compare due date with today
      const rawDate = (cob.dt_vencimento_recb || "").split(" ")[0];
      let isoDate = rawDate;
      if (rawDate.includes("/")) {
        const parts = rawDate.split("/");
        if (parts[2] && parts[2].length === 4) {
          // MM/DD/YYYY or DD/MM/YYYY — API returns MM/DD/YYYY
          isoDate = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
        }
      }
      cob.statusLabel = isoDate < todayStr ? "vencido" : "a_vencer";
    }

    cob.dt_vencimento_recb = toddmmyyyy(cob.dt_vencimento_recb);
  }

  return { units, cobrancas, cpfNotFound: false };
});

/**
 * Fallback: paginated scan of all units in the condominium,
 * matching CPF against contact fields.
 */
async function fallbackUnitSearch(
  idCondominio: string,
  cleanCpf: string,
  headers: Record<string, string>
): Promise<any[]> {
  const matched: any[] = [];
  let pagina = 1;
  let hasMore = true;
  const maxPages = 20; // safety limit

  while (hasMore && pagina <= maxPages) {
    const url = `${SUPERLOGICA_BASE_URL}/unidades/index?idCondominio=${idCondominio}&exibirDadosDosContatos=1&itensPorPagina=50&pagina=${pagina}`;
    const res = await fetch(url, { method: "GET", headers });

    if (!res.ok) {
      console.error(`[fallback] page ${pagina} error: ${res.status}`);
      break;
    }

    const page: any[] = await res.json();
    if (!Array.isArray(page) || page.length === 0) {
      hasMore = false;
      break;
    }

    for (const unit of page) {
      if (unitMatchesCpf(unit, cleanCpf)) {
        matched.push(unit);
      }
    }

    hasMore = page.length >= 50;
    pagina++;
  }

  return matched;
}

/**
 * Check if any CPF-like field in the unit or its contacts matches.
 */
function unitMatchesCpf(unit: any, cleanCpf: string): boolean {
  const fieldsToCheck = [
    unit.st_cpf_uni,
    unit.st_cnpj_uni,
    unit.st_cpfcnpj_uni,
  ];

  // Check contacts array
  const contatos = unit.contatos || unit.st_contatos || [];
  if (Array.isArray(contatos)) {
    for (const contato of contatos) {
      fieldsToCheck.push(
        contato.st_cpf_con,
        contato.st_cnpj_con,
        contato.st_cpfcnpj_con,
        contato.st_documento_con
      );
    }
  }

  for (const field of fieldsToCheck) {
    if (field && String(field).replace(/\D/g, "") === cleanCpf) {
      return true;
    }
  }

  return false;
}

export const generateBoletoLink = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { idCondominio, idRecebimento, dtVencimento, tenantId: overrideTenantId } = data;
  if (!idCondominio || !idRecebimento || !dtVencimento) {
    throw new functions.https.HttpsError("invalid-argument", "idCondominio, idRecebimento e dtVencimento são obrigatórios");
  }

  const tenantId = await resolveTenantId(context.auth.uid, overrideTenantId);
  const config = await getSuperlogicaConfig(tenantId);

  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  let cleanDate = dtVencimento.split(" ")[0];
  if (cleanDate.includes("-")) {
    const [y, m, d] = cleanDate.split("-");
    cleanDate = `${d}/${m}/${y}`;
  }

  const url = `${SUPERLOGICA_BASE_URL}/cobranca/gerarlinksegundavia?ID_CONDOMINIO_COND=${encodeURIComponent(idCondominio)}&ID_RECEBIMENTO_RECB=${encodeURIComponent(idRecebimento)}&DT_VENCIMENTO_RECB=${encodeURIComponent(cleanDate)}&DT_ATUALIZACAO_VENCIMENTO=${encodeURIComponent(today)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      app_token: config.appToken,
      access_token: config.accessToken,
    },
  });

  if (!response.ok) {
    throw new functions.https.HttpsError("internal", `Erro ao gerar link: ${response.status}`);
  }

  const result = await response.json();
  return result;
});
