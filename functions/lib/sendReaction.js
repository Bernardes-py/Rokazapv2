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
exports.sendReaction = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const zapiConfig_1 = require("./zapiConfig");
if (!admin.apps.length)
    admin.initializeApp();
exports.sendReaction = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { phone, messageId, emoji } = data;
    if (!phone || !messageId || !emoji) {
        throw new functions.https.HttpsError("invalid-argument", "phone, messageId e emoji são obrigatórios");
    }
    const config = await (0, zapiConfig_1.getZApiConfig)(context.auth.uid);
    const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/send-reaction`;
    console.log("sendReaction - URL Z-API:", url);
    const response = await (0, node_fetch_1.default)(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Client-Token": config.clientToken,
        },
        body: JSON.stringify({
            phone,
            messageId,
            emoji,
        }),
    });
    const responseText = await response.text();
    console.log("sendReaction - Response status:", response.status, "body:", responseText);
    if (!response.ok) {
        console.error("Erro Z-API sendReaction:", response.status, responseText);
        throw new functions.https.HttpsError("internal", `Erro Z-API (${response.status}): ${responseText}`);
    }
    let result;
    try {
        result = JSON.parse(responseText);
    }
    catch (_a) {
        result = { raw: responseText };
    }
    return result;
});
//# sourceMappingURL=sendReaction.js.map