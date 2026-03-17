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
exports.deleteChat = void 0;
const functions = __importStar(require("firebase-functions"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const zapiConfig_1 = require("./zapiConfig");
exports.deleteChat = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { phone } = data;
    console.log("deleteChat - Payload recebido:", JSON.stringify({ phone }));
    if (!phone) {
        throw new functions.https.HttpsError("invalid-argument", "phone é obrigatório");
    }
    const config = await (0, zapiConfig_1.getZApiConfig)(context.auth.uid);
    const missing = [];
    if (!config.instanceId)
        missing.push("instanceId");
    if (!config.instanceToken)
        missing.push("instanceToken");
    if (!config.clientToken)
        missing.push("clientToken");
    if (!config.apiUrl)
        missing.push("apiUrl");
    if (missing.length > 0) {
        throw new functions.https.HttpsError("failed-precondition", `Configuração Z-API incompleta. Campos ausentes: ${missing.join(", ")}`);
    }
    const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/modify-chat`;
    console.log("deleteChat - URL Z-API:", url);
    const response = await (0, node_fetch_1.default)(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Client-Token": config.clientToken,
        },
        body: JSON.stringify({ phone, action: "delete" }),
    });
    const responseText = await response.text();
    console.log("deleteChat - Response status:", response.status, "body:", responseText);
    if (!response.ok) {
        throw new functions.https.HttpsError("internal", `Erro Z-API (${response.status}): ${responseText}`);
    }
    let result;
    try {
        result = JSON.parse(responseText);
    }
    catch (e) {
        result = { value: true };
    }
    console.log("deleteChat - Sucesso!");
    return { success: true, ...result };
});
//# sourceMappingURL=deleteChat.js.map