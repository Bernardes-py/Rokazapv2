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
exports.syncSuperlogicaContacts = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const superlogicaConfig_1 = require("./superlogicaConfig");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
function cleanPhone(raw) {
    if (typeof raw !== "string" || raw.trim() === "")
        return null;
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 10)
        return null;
    const last11 = digits.slice(-11);
    const ddd = last11.slice(0, 2);
    const subscriber = last11.slice(3); // pula o "9" extra
    return "55" + ddd + subscriber;
}
exports.syncSuperlogicaContacts = functions
    .runWith({ timeoutSeconds: 300, memory: "512MB" })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    // Always use Lopes X credentials — manages all units
    const config = await (0, superlogicaConfig_1.getSuperlogicaConfig)();
    console.log(`[syncSuperlogicaContacts] using fallback credentials, condominioIds: ${JSON.stringify(config.condominioIds)}`);
    const headers = {
        "Content-Type": "application/json",
        app_token: config.appToken,
        access_token: config.accessToken,
    };
    const condoUrl = `${superlogicaConfig_1.SUPERLOGICA_BASE_URL}/condominios/get?id=-1&somenteCondominiosAtivos=1&apenasColunasPrincipais=1`;
    const condoResp = await (0, node_fetch_1.default)(condoUrl, { method: "GET", headers });
    if (!condoResp.ok)
        throw new functions.https.HttpsError("internal", `Erro condominios: ${condoResp.status}`);
    let condos = await condoResp.json();
    // Filter by condominioIds if configured
    if (config.condominioIds && config.condominioIds.length > 0) {
        condos = condos.filter((c) => config.condominioIds.includes(String(c.id_condominio_cond)));
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
            const unitsUrl = `${superlogicaConfig_1.SUPERLOGICA_BASE_URL}/unidades/index?idCondominio=${condoId}&exibirDadosDosContatos=1&pagina=${page}&itensPorPagina=50`;
            const unitsResp = await (0, node_fetch_1.default)(unitsUrl, { method: "GET", headers });
            if (!unitsResp.ok)
                break;
            const units = await unitsResp.json();
            if (!Array.isArray(units) || units.length === 0)
                break;
            for (const unit of units) {
                const bloco = unit.st_bloco_uni || "";
                const unidade = unit.st_unidade_uni || "";
                const ownerPhones = [unit.celular_proprietario, unit.telefone_proprietario];
                const contatos = Array.isArray(unit.contatos) ? unit.contatos : [];
                const entries = [];
                if (contatos.length === 0) {
                    const phones = [...new Set(ownerPhones.map(cleanPhone).filter(Boolean))];
                    if (phones.length > 0)
                        entries.push({ name: "", phones });
                }
                else {
                    for (const c of contatos) {
                        const rawPhones = [
                            ...ownerPhones,
                            c.st_telefone_con, c.st_celular_con, c.st_fone_con,
                            c.st_fonecomercial_con, c.st_fone2_con, c.st_celular2_con,
                        ];
                        const phones = [...new Set(rawPhones.map(cleanPhone).filter(Boolean))];
                        if (phones.length > 0)
                            entries.push({ name: c.st_nome_con || "", phones });
                    }
                }
                for (const entry of entries) {
                    const phone = entry.phones[0];
                    const contactQuery = db.collection("contacts").where("phone", "==", phone);
                    const snap = await contactQuery.limit(1).get();
                    if (!snap.empty) {
                        const doc = snap.docs[0];
                        const existing = doc.data();
                        const updateData = {
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
                    }
                    else {
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
            if (units.length < 50)
                break;
            page++;
        }
    }
    const synced = created + updated;
    console.log(`[syncSuperlogicaContacts] ${condos.length} condominios, ${synced} sincronizados (${created} criados, ${updated} atualizados)`);
    return { synced, created, updated };
});
//# sourceMappingURL=syncSuperlogicaContacts.js.map