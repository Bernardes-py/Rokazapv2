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
exports.listUnidades = void 0;
const functions = __importStar(require("firebase-functions"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const superlogicaConfig_1 = require("./superlogicaConfig");
/**
 * Lista todas as unidades dos condomínios vinculados ao tenant,
 * incluindo dados dos contatos/moradores.
 */
exports.listUnidades = functions
    .runWith({ timeoutSeconds: 120, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const overrideTenantId = data === null || data === void 0 ? void 0 : data.tenantId;
    const tenantId = await (0, superlogicaConfig_1.resolveTenantId)(context.auth.uid, overrideTenantId);
    let config;
    try {
        config = await (0, superlogicaConfig_1.getSuperlogicaConfig)(tenantId);
    }
    catch (err) {
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
    const condoUrl = `${superlogicaConfig_1.SUPERLOGICA_BASE_URL}/condominios/get?id=-1&somenteCondominiosAtivos=1&apenasColunasPrincipais=1`;
    const condoResp = await (0, node_fetch_1.default)(condoUrl, { method: "GET", headers });
    if (!condoResp.ok)
        throw new functions.https.HttpsError("internal", `Erro condominios: ${condoResp.status}`);
    let condos = await condoResp.json();
    // Filter by condominioIds if configured
    if (config.condominioIds && config.condominioIds.length > 0) {
        condos = condos.filter((c) => config.condominioIds.includes(String(c.id_condominio_cond)));
    }
    const allUnits = [];
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
                allUnits.push({
                    ...unit,
                    st_nome_cond: condoName,
                    id_condominio_cond: condoId,
                });
            }
            if (units.length < 50)
                break;
            page++;
        }
    }
    console.log(`[listUnidades] ${condos.length} condominios, ${allUnits.length} unidades`);
    return allUnits;
});
//# sourceMappingURL=listUnidades.js.map