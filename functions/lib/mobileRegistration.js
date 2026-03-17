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
exports.respondCaptcha = exports.confirmRegistrationCode = exports.requestRegistrationCode = exports.checkRegistrationAvailable = void 0;
const functions = __importStar(require("firebase-functions"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const zapiConfig_1 = require("./zapiConfig");
exports.checkRegistrationAvailable = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { ddi, phone } = data;
    if (!ddi || !phone) {
        throw new functions.https.HttpsError("invalid-argument", "ddi e phone são obrigatórios");
    }
    const config = await (0, zapiConfig_1.getZApiConfig)(context.auth.uid);
    const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/mobile/registration-available`;
    const response = await (0, node_fetch_1.default)(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Client-Token": config.clientToken,
        },
        body: JSON.stringify({ ddi, phone }),
    });
    const result = await response.json();
    if (!response.ok) {
        console.error("checkRegistrationAvailable erro:", response.status, result);
        throw new functions.https.HttpsError("internal", `Erro Z-API (${response.status})`);
    }
    return result;
});
exports.requestRegistrationCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { ddi, phone, method } = data;
    if (!ddi || !phone || !method) {
        throw new functions.https.HttpsError("invalid-argument", "ddi, phone e method são obrigatórios");
    }
    const config = await (0, zapiConfig_1.getZApiConfig)(context.auth.uid);
    const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/mobile/request-registration-code`;
    const response = await (0, node_fetch_1.default)(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Client-Token": config.clientToken,
        },
        body: JSON.stringify({ ddi, phone, method }),
    });
    const result = await response.json();
    if (!response.ok) {
        console.error("requestRegistrationCode erro:", response.status, result);
    }
    // Retorna sempre o resultado (pode conter captcha, retryAfter, banned, etc.)
    return result;
});
exports.confirmRegistrationCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { code } = data;
    if (!code) {
        throw new functions.https.HttpsError("invalid-argument", "code é obrigatório");
    }
    const config = await (0, zapiConfig_1.getZApiConfig)(context.auth.uid);
    const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/mobile/confirm-registration-code`;
    const response = await (0, node_fetch_1.default)(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Client-Token": config.clientToken,
        },
        body: JSON.stringify({ code }),
    });
    const result = await response.json();
    if (!response.ok) {
        console.error("confirmRegistrationCode erro:", response.status, result);
    }
    return result;
});
exports.respondCaptcha = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { captcha } = data;
    if (!captcha) {
        throw new functions.https.HttpsError("invalid-argument", "captcha é obrigatório");
    }
    const config = await (0, zapiConfig_1.getZApiConfig)(context.auth.uid);
    const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/mobile/respond-captcha`;
    const response = await (0, node_fetch_1.default)(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Client-Token": config.clientToken,
        },
        body: JSON.stringify({ captcha }),
    });
    const result = await response.json();
    if (!response.ok) {
        console.error("respondCaptcha erro:", response.status, result);
    }
    return result;
});
//# sourceMappingURL=mobileRegistration.js.map