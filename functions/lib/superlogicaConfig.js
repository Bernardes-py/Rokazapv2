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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPERLOGICA_BASE_URL = void 0;
exports.getSuperlogicaConfig = getSuperlogicaConfig;
exports.resolveTenantId = resolveTenantId;
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
const LOPES_X_TENANT_ID = "5GlQDHGt7tNqFYnQtg0V";
// Fallback tokens (hardcoded for initial setup)
const FALLBACK_APP_TOKEN = "46cee13a-6807-4676-a287-7c474c3f128a";
const FALLBACK_ACCESS_TOKEN = "e4ec698c-9e15-4279-a2dd-76b5e0cb3ee0";
/**
 * Resolve Superlógica credentials by tenantId.
 * Priority: 1) doc matching tenantId, 2) first doc in collection, 3) hardcoded fallback.
 */
async function getSuperlogicaConfig(tenantId) {
    const extractConfig = (data) => {
        if (data.appToken && data.accessToken) {
            return {
                appToken: data.appToken,
                accessToken: data.accessToken,
                condominioIds: data.condominioIds || [],
            };
        }
        return null;
    };
    try {
        if (tenantId) {
            // 1) Query by tenantId field (works for Lopes X where tenantId matches)
            const tenantSnap = await db
                .collection("superlogica_config")
                .where("tenantId", "==", tenantId)
                .limit(1)
                .get();
            if (!tenantSnap.empty) {
                const cfg = extractConfig(tenantSnap.docs[0].data());
                if (cfg) {
                    console.log(`[superlogicaConfig] Resolved by tenantId field: ${tenantId}`);
                    return cfg;
                }
            }
            // 2) Try fetching document by ID (if doc ID = Firestore tenant ID)
            const docSnap = await db.collection("superlogica_config").doc(tenantId).get();
            if (docSnap.exists) {
                const cfg = extractConfig(docSnap.data());
                if (cfg) {
                    console.log(`[superlogicaConfig] Resolved by doc ID: ${tenantId}`);
                    return cfg;
                }
            }
            // 3) Try by firestoreTenantId field (reverse mapping for Campos Altos etc.)
            const reverseSnap = await db
                .collection("superlogica_config")
                .where("firestoreTenantId", "==", tenantId)
                .limit(1)
                .get();
            if (!reverseSnap.empty) {
                const cfg = extractConfig(reverseSnap.docs[0].data());
                if (cfg) {
                    console.log(`[superlogicaConfig] Resolved by firestoreTenantId: ${tenantId}`);
                    return cfg;
                }
            }
            console.warn(`[superlogicaConfig] No config found for tenant ${tenantId}, trying fallback`);
        }
        // 4) Auto-link: find unlinked config and bind it to this tenantId
        if (tenantId) {
            const allConfigs = await db.collection("superlogica_config").get();
            const candidates = [];
            for (const configDoc of allConfigs.docs) {
                const data = configDoc.data();
                if (!data.firestoreTenantId && data.appToken && data.accessToken) {
                    candidates.push(configDoc);
                }
            }
            if (candidates.length === 1) {
                const chosen = candidates[0];
                await chosen.ref.update({ firestoreTenantId: tenantId });
                console.log(`[superlogicaConfig] Auto-linked doc ${chosen.id} → firestoreTenantId: ${tenantId}`);
                return extractConfig(chosen.data());
            }
            else if (candidates.length > 1) {
                console.warn(`[superlogicaConfig] ${candidates.length} unlinked configs found, cannot auto-link for tenant ${tenantId}`);
            }
            // No auto-link possible — fall back to first available config with warning
            console.warn(`[superlogicaConfig] No auto-link possible for tenant ${tenantId}, falling back to first available config`);
        }
        // Lopes X: use legacy fallback tokens if no Firestore config exists
        if (tenantId === LOPES_X_TENANT_ID) {
            console.log(`[superlogicaConfig] Using legacy fallback for Lopes X (${tenantId})`);
            return { appToken: FALLBACK_APP_TOKEN, accessToken: FALLBACK_ACCESS_TOKEN };
        }
        // No config found for this tenant — throw error instead of falling back to another tenant's credentials
        throw new Error(`Nenhuma configuração Superlógica encontrada para o tenant ${tenantId}`);
    }
    catch (err) {
        if (err instanceof Error && err.message.includes("Nenhuma configuração")) {
            throw err; // Re-throw intentional errors
        }
        console.warn("[superlogicaConfig] Falha ao ler config do Firestore, usando fallback:", err);
    }
    return { appToken: FALLBACK_APP_TOKEN, accessToken: FALLBACK_ACCESS_TOKEN };
}
/**
 * Resolve tenantId from authenticated user's Firestore document.
 * Accepts optional override (for admin tenant switching).
 */
async function resolveTenantId(uid, overrideTenantId) {
    var _a, _b;
    if (overrideTenantId) {
        // Validate caller is admin before accepting override
        const userDoc = await db.collection("users").doc(uid).get();
        const profile = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.profile;
        if (profile === "admin") {
            console.log(`[resolveTenantId] Admin override tenant: ${overrideTenantId}`);
            return overrideTenantId;
        }
        console.warn(`[resolveTenantId] Non-admin tried override, ignoring`);
    }
    const userDoc = await db.collection("users").doc(uid).get();
    const tenantId = (_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.tenantId;
    console.log(`[resolveTenantId] User ${uid} -> tenant: ${tenantId}`);
    return tenantId;
}
exports.SUPERLOGICA_BASE_URL = "https://api.superlogica.net/v2/condor";
//# sourceMappingURL=superlogicaConfig.js.map