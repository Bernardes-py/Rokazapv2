import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();

const VALID_DEPARTMENTS = ['Atendente', 'Comercial', 'Contabilidade', 'Financeiro', 'Tecnologia'];

export const createUser = functions.https.onCall(async (data, context) => {
  const callerUid = context.auth?.uid;
  if (!callerUid) throw new functions.https.HttpsError('unauthenticated', 'Login necessário');

  // Verify caller is admin
  const callerDoc = await admin.firestore().doc(`users/${callerUid}`).get();
  if (!callerDoc.exists || callerDoc.data()?.profile !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Apenas admins podem criar usuários');
  }

  const callerTenantId = callerDoc.data()?.tenantId || '';

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
  } catch (err: any) {
    // Re-throw if already an HttpsError
    if (err instanceof functions.https.HttpsError) throw err;

    const code = err?.errorInfo?.code || err?.code || '';
    const errorMap: Record<string, { status: functions.https.FunctionsErrorCode; msg: string }> = {
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
    throw new functions.https.HttpsError('internal', err?.message || 'Erro ao criar usuário. Tente novamente.');
  }
});
