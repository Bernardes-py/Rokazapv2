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
exports.createUser = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const VALID_DEPARTMENTS = ['Atendente', 'Comercial', 'Contabilidade', 'Financeiro', 'Tecnologia'];
exports.createUser = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d;
    const callerUid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!callerUid)
        throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
    // Verify caller is admin
    const callerDoc = await admin.firestore().doc(`users/${callerUid}`).get();
    if (!callerDoc.exists || ((_b = callerDoc.data()) === null || _b === void 0 ? void 0 : _b.profile) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Apenas admins podem criar usuários');
    }
    const callerTenantId = ((_c = callerDoc.data()) === null || _c === void 0 ? void 0 : _c.tenantId) || '';
    const { name, email, password, department, profile, tenantId } = data;
    // Use provided tenantId (for master admin creating users in other tenants) or caller's tenantId
    const finalTenantId = tenantId || callerTenantId;
    if (!name || !email || !password || !department || !profile) {
        throw new functions.https.HttpsError('invalid-argument', 'Todos os campos são obrigatórios');
    }
    if (!VALID_DEPARTMENTS.includes(department)) {
        throw new functions.https.HttpsError('invalid-argument', 'Departamento inválido');
    }
    if (department !== 'Tecnologia' && profile === 'admin') {
        throw new functions.https.HttpsError('invalid-argument', 'Apenas Tecnologia pode ter perfil admin');
    }
    if (password.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Senha deve ter pelo menos 6 caracteres');
    }
    try {
        const userRecord = await admin.auth().createUser({ email, password, displayName: name });
        await admin.firestore().doc(`users/${userRecord.uid}`).set({
            name, email, department, profile,
            tenantId: finalTenantId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { uid: userRecord.uid };
    }
    catch (err) {
        // Re-throw if already an HttpsError
        if (err instanceof functions.https.HttpsError)
            throw err;
        const code = ((_d = err === null || err === void 0 ? void 0 : err.errorInfo) === null || _d === void 0 ? void 0 : _d.code) || (err === null || err === void 0 ? void 0 : err.code) || '';
        const errorMap = {
            'auth/email-already-exists': { status: 'already-exists', msg: 'Este email já está cadastrado.' },
            'auth/invalid-email': { status: 'invalid-argument', msg: 'Email inválido.' },
            'auth/invalid-password': { status: 'invalid-argument', msg: 'Senha inválida. Deve ter pelo menos 6 caracteres.' },
            'auth/uid-already-exists': { status: 'already-exists', msg: 'UID já existe.' },
        };
        const mapped = errorMap[code];
        if (mapped) {
            throw new functions.https.HttpsError(mapped.status, mapped.msg);
        }
        console.error('Erro inesperado em createUser:', err);
        throw new functions.https.HttpsError('internal', (err === null || err === void 0 ? void 0 : err.message) || 'Erro ao criar usuário. Tente novamente.');
    }
});
//# sourceMappingURL=createUser.js.map