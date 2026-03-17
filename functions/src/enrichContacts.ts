import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { getSuperlogicaConfig, resolveTenantId, SUPERLOGICA_BASE_URL } from "./superlogicaConfig";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return digits;
  const last11 = digits.slice(-11);
  const ddd = last11.slice(0, 2);
  const subscriber = last11.slice(3); // pula o "9" extra
  return "55" + ddd + subscriber;
}

function extractSubscriber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-8);
  if (digits.length === 8) return digits;
  return digits;
}

const PHONE_FIELDS = [
  "st_telefone_con", "st_fone_con", "st_celular_con", "st_fonecomercial_con",
  "st_fone2_con", "st_celular2_con",
];

// Unit-level owner phone fields
const OWNER_PHONE_FIELDS = ["celular_proprietario", "telefone_proprietario"];

export const enrichContacts = functions.runWith({ timeoutSeconds: 540, memory: "512MB" }).https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const tenantId = await resolveTenantId(context.auth.uid);
  const config = await getSuperlogicaConfig(tenantId);
  console.log(`[enrichContacts] tenant: ${tenantId}, condominioIds: ${JSON.stringify(config.condominioIds)}`);

  // 1. Read contacts needing enrichment (scoped to tenant)
  let contactsQuery: FirebaseFirestore.Query = db.collection("contacts");
  if (tenantId) {
    contactsQuery = contactsQuery.where("tenantId", "==", tenantId);
  }
  const contactsSnap = await contactsQuery.get();
  const allContacts = contactsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Array<{ id: string; phone: string; name?: string; condominium?: string; [k: string]: unknown }>;
  const toEnrich = allContacts.filter(c => !c.condominium || (c.condominium as string).trim() === "");

  if (toEnrich.length === 0) {
    return { enriched: 0, notFound: 0, total: allContacts.length };
  }

  // 2. Build subscriber map: subscriberNumber → contact
  const subscriberMap = new Map<string, typeof toEnrich[0]>();
  for (const contact of toEnrich) {
    const sub = normalizePhone(contact.phone);
    if (sub && sub.length >= 8) {
      subscriberMap.set(sub, contact);
    }
  }

  console.log(`[enrichContacts] ${toEnrich.length} contatos para enriquecer, ${subscriberMap.size} com telefone válido`);

  // 3. Fetch active condominiums
  const condoUrl = `${SUPERLOGICA_BASE_URL}/condominios/get?id=-1&somenteCondominiosAtivos=1&apenasColunasPrincipais=1`;
  const condoRes = await fetch(condoUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "app_token": config.appToken,
      "access_token": config.accessToken,
    },
  });

  if (!condoRes.ok) {
    throw new functions.https.HttpsError("internal", `Erro ao listar condomínios: ${condoRes.status}`);
  }

  const condominios = (await condoRes.json()) as Array<{ id_condominio_cond: string; st_fantasia_cond: string }>;

  // Filter by condominioIds if configured
  let filteredCondominios = condominios;
  if (config.condominioIds && config.condominioIds.length > 0) {
    filteredCondominios = condominios.filter(c =>
      config.condominioIds!.includes(String(c.id_condominio_cond))
    );
    console.log(`[enrichContacts] filtered to ${filteredCondominios.length} condominios`);
  }
  console.log(`[enrichContacts] ${filteredCondominios.length} condomínios ativos`);

  let enriched = 0;

  // 4. For each condominium, fetch ALL units with contacts
  for (const condo of filteredCondominios) {
    if (subscriberMap.size === 0) break; // all matched

    try {
      // Pagination loop
      let page = 1;
      let totalUnitsInCondo = 0;

      while (true) {
        if (subscriberMap.size === 0) break;

        const unitsUrl = `${SUPERLOGICA_BASE_URL}/unidades/index?idCondominio=${condo.id_condominio_cond}&exibirDadosDosContatos=1&pagina=${page}`;
        const res = await fetch(unitsUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "app_token": config.appToken,
            "access_token": config.accessToken,
          },
        });

        if (!res.ok) {
          console.warn(`[enrichContacts] Erro HTTP ${res.status} no condo ${condo.id_condominio_cond} page ${page}`);
          break;
        }

        const units = (await res.json()) as Array<Record<string, unknown>>;
        if (!Array.isArray(units) || units.length === 0) break;

        totalUnitsInCondo += units.length;

        for (const unit of units) {
          if (subscriberMap.size === 0) break;

          // Check unit-level owner phones first
          for (const ownerField of OWNER_PHONE_FIELDS) {
            const val = unit[ownerField];
            if (typeof val !== "string" || val.length === 0) continue;
            const sub = extractSubscriber(val);
            if (sub.length === 8) {
              const match = subscriberMap.get(sub);
              if (match) {
                const updateData: Record<string, string> = {
                  condominium: condo.st_fantasia_cond || "",
                  unit: (unit.st_unidade_uni as string) || "",
                  block: (unit.st_bloco_uni as string) || "",
                };
                const ownerName = (unit.nome_proprietario as string) || "";
                if (ownerName && (!match.name || match.name.trim() === "")) {
                  updateData.name = ownerName;
                }
                await db.collection("contacts").doc(match.id).update(updateData);
                console.log(`[enrichContacts] ✅ ${match.phone} → ${condo.st_fantasia_cond} / ${updateData.unit} (owner)`);
                enriched++;
                subscriberMap.delete(sub);
              }
            }
          }

          // Check contact-level phones
          const contatos = Array.isArray(unit.contatos) ? unit.contatos as Array<Record<string, unknown>> : [];

          for (const contato of contatos) {
            if (subscriberMap.size === 0) break;
            for (const field of PHONE_FIELDS) {
              const val = contato[field];
              if (typeof val !== "string" || val.length === 0) continue;

              const sub = extractSubscriber(val);
              // Only match 9-digit mobile numbers starting with 9
              if (sub.length !== 8) continue;

              const match = subscriberMap.get(sub);
              if (!match) continue;

              const updateData: Record<string, string> = {
                condominium: condo.st_fantasia_cond || "",
                unit: (unit.st_unidade_uni as string) || "",
                block: (unit.st_bloco_uni as string) || "",
              };

              const contactName = (contato.st_nome_con as string) || "";
              if (contactName && (!match.name || match.name.trim() === "")) {
                updateData.name = contactName;
              }

              await db.collection("contacts").doc(match.id).update(updateData);
              console.log(`[enrichContacts] ✅ ${match.phone} → ${condo.st_fantasia_cond} / ${updateData.unit}`);
              enriched++;
              subscriberMap.delete(sub);
              break;
            }
          }
        }

        // If less than 50, we've reached the last page
        if (units.length < 50) break;
        page++;
      }

      if (totalUnitsInCondo > 0) {
        console.log(`[enrichContacts] Condo "${condo.st_fantasia_cond}": ${totalUnitsInCondo} unidades (${page} páginas)`);
      }
    } catch (err) {
      console.warn(`[enrichContacts] Erro no condo ${condo.id_condominio_cond}:`, err);
    }
  }

  const notFound = toEnrich.length - enriched;
  console.log(`[enrichContacts] Resultado: enriched=${enriched}, notFound=${notFound}, total=${allContacts.length}`);
  return { enriched, notFound, total: allContacts.length };
});
