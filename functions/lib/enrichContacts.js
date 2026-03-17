"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichContacts = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const superlogicaConfig_1 = require("./superlogicaConfig");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
function normalizePhone(phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10)
        return digits;
    const last11 = digits.slice(-11);
    const ddd = last11.slice(0, 2);
    const subscriber = last11.slice(3); // pula o "9" extra
    return "55" + ddd + subscriber;
}
function extractSubscriber(phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10)
        return digits.slice(-8);
    if (digits.length === 8)
        return digits;
    return digits;
}
const PHONE_FIELDS = [
    "st_telefone_con", "st_fone_con", "st_celular_con", "st_fonecomercial_con",
    "st_fone2_con", "st_celular2_con",
];
// Unit-level owner phone fields
const OWNER_PHONE_FIELDS = ["celular_proprietario", "telefone_proprietario"];
exports.enrichContacts = functions.runWith({ timeoutSeconds: 540, memory: "512MB" }).https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const tenantId = await (0, superlogicaConfig_1.resolveTenantId)(context.auth.uid);
    const config = await (0, superlogicaConfig_1.getSuperlogicaConfig)(tenantId);
    console.log(`[enrichContacts] tenant: ${tenantId}, condominioIds: ${JSON.stringify(config.condominioIds)}`);
    // 1. Read contacts needing enrichment (scoped to tenant)
    let contactsQuery = db.collection("contacts");
    if (tenantId) {
        contactsQuery = contactsQuery.where("tenantId", "==", tenantId);
    }
    const contactsSnap = await contactsQuery.get();
    const allContacts = contactsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const toEnrich = allContacts.filter(c => !c.condominium || c.condominium.trim() === "");
    if (toEnrich.length === 0) {
        return { enriched: 0, notFound: 0, total: allContacts.length };
    }
    // 2. Build subscriber map: subscriberNumber → contact
    const subscriberMap = new Map();
    for (const contact of toEnrich) {
        const sub = normalizePhone(contact.phone);
        if (sub && sub.length >= 8) {
            subscriberMap.set(sub, contact);
        }
    }
    console.log(`[enrichContacts] ${toEnrich.length} contatos para enriquecer, ${subscriberMap.size} com telefone válido`);
    // 3. Fetch active condominiums
    const condoUrl = `${superlogicaConfig_1.SUPERLOGICA_BASE_URL}/condominios/get?id=-1&somenteCondominiosAtivos=1&apenasColunasPrincipais=1`;
    const condoRes = await (0, node_fetch_1.default)(condoUrl, {
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
    const condominios = (await condoRes.json());
    // Filter by condominioIds if configured
    let filteredCondominios = condominios;
    if (config.condominioIds && config.condominioIds.length > 0) {
        filteredCondominios = condominios.filter(c => config.condominioIds.includes(String(c.id_condominio_cond)));
        console.log(`[enrichContacts] filtered to ${filteredCondominios.length} condominios`);
    }
    console.log(`[enrichContacts] ${filteredCondominios.length} condomínios ativos`);
    let enriched = 0;
    // 4. For each condominium, fetch ALL units with contacts
    for (const condo of filteredCondominios) {
        if (subscriberMap.size === 0)
            break; // all matched
        try {
            // Pagination loop
            let page = 1;
            let totalUnitsInCondo = 0;
            while (true) {
                if (subscriberMap.size === 0)
                    break;
                const unitsUrl = `${superlogicaConfig_1.SUPERLOGICA_BASE_URL}/unidades/index?idCondominio=${condo.id_condominio_cond}&exibirDadosDosContatos=1&pagina=${page}`;
                const res = await (0, node_fetch_1.default)(unitsUrl, {
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
                const units = (await res.json());
                if (!Array.isArray(units) || units.length === 0)
                    break;
                totalUnitsInCondo += units.length;
                for (const unit of units) {
                    if (subscriberMap.size === 0)
                        break;
                    // Check unit-level owner phones first
                    for (const ownerField of OWNER_PHONE_FIELDS) {
                        const val = unit[ownerField];
                        if (typeof val !== "string" || val.length === 0)
                            continue;
                        const sub = extractSubscriber(val);
                        if (sub.length === 8) {
                            const match = subscriberMap.get(sub);
                            if (match) {
                                const updateData = {
                                    condominium: condo.st_fantasia_cond || "",
                                    unit: unit.st_unidade_uni || "",
                                    block: unit.st_bloco_uni || "",
                                };
                                const ownerName = unit.nome_proprietario || "";
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
                    const contatos = Array.isArray(unit.contatos) ? unit.contatos : [];
                    for (const contato of contatos) {
                        if (subscriberMap.size === 0)
                            break;
                        for (const field of PHONE_FIELDS) {
                            const val = contato[field];
                            if (typeof val !== "string" || val.length === 0)
                                continue;
                            const sub = extractSubscriber(val);
                            // Only match 9-digit mobile numbers starting with 9
                            if (sub.length !== 8)
                                continue;
                            const match = subscriberMap.get(sub);
                            if (!match)
                                continue;
                            const updateData = {
                                condominium: condo.st_fantasia_cond || "",
                                unit: unit.st_unidade_uni || "",
                                block: unit.st_bloco_uni || "",
                            };
                            const contactName = contato.st_nome_con || "";
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
                if (units.length < 50)
                    break;
                page++;
            }
            if (totalUnitsInCondo > 0) {
                console.log(`[enrichContacts] Condo "${condo.st_fantasia_cond}": ${totalUnitsInCondo} unidades (${page} páginas)`);
            }
        }
        catch (err) {
            console.warn(`[enrichContacts] Erro no condo ${condo.id_condominio_cond}:`, err);
        }
    }
    const notFound = toEnrich.length - enriched;
    console.log(`[enrichContacts] Resultado: enriched=${enriched}, notFound=${notFound}, total=${allContacts.length}`);
    return { enriched, notFound, total: allContacts.length };
});
//# sourceMappingURL=enrichContacts.js.map