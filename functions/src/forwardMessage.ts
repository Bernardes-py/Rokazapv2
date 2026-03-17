import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { getZApiConfig } from "./zapiConfig";

if (!admin.apps.length) admin.initializeApp();

export const forwardMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { phone, messageId, messagePhone } = data;
  console.log("forwardMessage - Payload:", JSON.stringify({ phone, messageId, messagePhone }));

  if (!phone || !messageId || !messagePhone) {
    throw new functions.https.HttpsError("invalid-argument", "phone, messageId e messagePhone são obrigatórios");
  }

  const config = await getZApiConfig(context.auth.uid);

  const missing: string[] = [];
  if (!config.instanceId) missing.push("instanceId");
  if (!config.instanceToken) missing.push("instanceToken");
  if (!config.clientToken) missing.push("clientToken");
  if (!config.apiUrl) missing.push("apiUrl");
  if (missing.length > 0) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Configuração Z-API incompleta. Campos ausentes: ${missing.join(", ")}`
    );
  }

  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/forward-message`;
  console.log("forwardMessage - URL:", url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": config.clientToken,
    },
    body: JSON.stringify({ phone, messageId, messagePhone }),
  });

  const responseText = await response.text();
  console.log("forwardMessage - Response:", response.status, responseText);

  if (!response.ok) {
    throw new functions.https.HttpsError("internal", `Erro Z-API (${response.status}): ${responseText}`);
  }

  let result: { zaapId?: string };
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new functions.https.HttpsError("internal", "Resposta Z-API inválida");
  }

  return { zaapId: result.zaapId };
});
