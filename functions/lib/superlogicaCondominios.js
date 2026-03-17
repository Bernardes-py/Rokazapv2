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
exports.listCondominios = void 0;
const functions = __importStar(require("firebase-functions"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const superlogicaConfig_1 = require("./superlogicaConfig");
exports.listCondominios = functions.https.onCall(async (data, context) => {
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
        console.error(`[listCondominios] Config resolution failed for tenant ${tenantId}:`, err);
        throw new functions.https.HttpsError("not-found", `Configuração Superlógica não encontrada para o tenant ${tenantId}. Vincule as credenciais primeiro.`);
    }
    if (!config.appToken || !config.accessToken) {
        throw new functions.https.HttpsError("not-found", `Credenciais Superlógica ausentes para o tenant ${tenantId}.`);
    }
    console.log(`[listCondominios] tenant: ${tenantId}`);
    const url = `${superlogicaConfig_1.SUPERLOGICA_BASE_URL}/condominios/get?id=-1&somenteCondominiosAtivos=1&apenasColunasPrincipais=1`;
    const response = await (0, node_fetch_1.default)(url, {
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
    let condominios = await response.json();
    // Filter by condominioIds if configured
    if (config.condominioIds && config.condominioIds.length > 0) {
        condominios = condominios.filter((c) => config.condominioIds.includes(String(c.id_condominio_cond)));
        console.log(`[listCondominios] filtered to ${condominios.length} condominios`);
    }
    return condominios;
});
//# sourceMappingURL=superlogicaCondominios.js.map