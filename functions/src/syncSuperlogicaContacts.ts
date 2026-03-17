import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { getSuperlogicaConfig, SUPERLOGICA_BASE_URL } from "./superlogicaConfig";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function cleanPhone(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const last11 = digits.slice(-11);
  const ddd = last11.slice(0, 2);
  const subscriber = last11.slice(3); // pula o "9" extra
  return "55" + ddd + subscriber;
}

export const syncSuperlogicaContacts = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }

    // Always use Lopes X credentials — manages all units
    const config = await getSuperlogicaConfig();
    console.log(`[syncSuperlogicaContacts] using fallback credentials, condominioIds: ${JSON.stringify(config.condominioIds)}`);
    const headers = {
      "Content-Type": "application/json",
      app_token: config.appToken,
      access_token: config.accessToken,
    };

    const condoUrl = `${SUPERLOGICA_BASE_URL}/condominios/get?id=-1&somenteCondominiosAtivos=1&apenasColunasPrincipais=1`;
    const condoResp = await fetch(condoUrl, { method: "GET", headers });
    if (!condoResp.ok) throw new functions.https.HttpsError("internal", `Erro condominios: ${condoResp.status}`);
    let condos: any[] = await condoResp.json();

    // Filter by condominioIds if configured
    if (config.condominioIds && config.condominioIds.length > 0) {
      condos = condos.filter((c: any) =>
        config.condominioIds!.includes(String(c.id_condominio_cond))
      );
      console.log(`[syncSuperlogicaContacts] filtered to ${condos.length} condominios`);
    }

    let created = 0;
    let updated = 0;
    const now = admin.firestore.FieldValue.serverTimestamp();

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
          const bloco = unit.st_bloco_uni || "";
          const unidade = unit.st_unidade_uni || "";
          const ownerPhones = [unit.celular_proprietario, unit.telefone_proprietario];
          const contatos = Array.isArray(unit.contatos) ? unit.contatos : [];

          const entries: { name: string; phones: string[] }[] = [];

          if (contatos.length === 0) {
            const phones = [...new Set(ownerPhones.map(cleanPhone).filter(Boolean) as string[])];
            if (phones.length > 0) entries.push({ name: "", phones });
          } else {
            for (const c of contatos) {
              const rawPhones = [
                ...ownerPhones,
                c.st_telefone_con, c.st_celular_con, c.st_fone_con,
                c.st_fonecomercial_con, c.st_fone2_con, c.st_celular2_con,
              ];
              const phones = [...new Set(rawPhones.map(cleanPhone).filter(Boolean) as string[])];
              if (phones.length > 0) entries.push({ name: c.st_nome_con || "", phones });
            }
          }

          for (const entry of entries) {
            const phone = entry.phones[0];
            const contactQuery = db.collection("contacts").where("phone", "==", phone);
            const snap = await contactQuery.limit(1).get();

            if (!snap.empty) {
              const doc = snap.docs[0];
              const existing = doc.data();
              const updateData: any = {
                condominium: condoName,
                block: bloco,
                unit: unidade,
                updatedAt: now,
              };
              if (!existing.name && entry.name) {
                updateData.name = entry.name;
              }
              await doc.ref.update(updateData);
              updated++;
            } else {
              await db.collection("contacts").add({
                phone,
                name: entry.name,
                avatar: "",
                email: "",
                cpf: "",
                condominium: condoName,
                block: bloco,
                unit: unidade,
                address: "",
                customNotes: "",
                tags: [],
                tenantId: "",
                createdAt: now,
                updatedAt: now,
              });
              created++;
            }
          }
        }

        if (units.length < 50) break;
        page++;
      }
    }

    const synced = created + updated;
    console.log(`[syncSuperlogicaContacts] ${condos.length} condominios, ${synced} sincronizados (${created} criados, ${updated} atualizados)`);
    return { synced, created, updated };
  });
