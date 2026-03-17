import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { getZApiConfig } from "./zapiConfig";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const sendMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { phone, message, conversationId, messageDocId } = data;
  console.log("sendMessage - Payload recebido:", JSON.stringify({ phone, message, conversationId, messageDocId }));

  if (!phone || !message || !conversationId || !messageDocId) {
    throw new functions.https.HttpsError("invalid-argument", "phone, message, conversationId e messageDocId são obrigatórios");
  }

  const config = await getZApiConfig(context.auth.uid);

  const missing: string[] = [];
  if (!config.instanceId) missing.push("instanceId");
  if (!config.instanceToken) missing.push("instanceToken");
  if (!config.clientToken) missing.push("clientToken");
  if (!config.apiUrl) missing.push("apiUrl");
  if (missing.length > 0) {
    console.error("Campos ausentes na config Z-API:", missing.join(", "));
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Configuração Z-API incompleta. Campos ausentes: ${missing.join(", ")}`
    );
  }

  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/send-text`;
  console.log("sendMessage - URL Z-API:", url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": config.clientToken,
    },
    body: JSON.stringify({ phone, message }),
  });

  const responseText = await response.text();
  console.log("sendMessage - Response status:", response.status, "body:", responseText);

  if (!response.ok) {
    console.error("Erro Z-API:", response.status, responseText);
    throw new functions.https.HttpsError("internal", `Erro Z-API (${response.status}): ${responseText}`);
  }

  let result: { zaapId?: string; messageId?: string };
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    console.error("sendMessage - Falha ao parsear resposta Z-API:", responseText);
    throw new functions.https.HttpsError("internal", "Resposta Z-API inválida (não é JSON)");
  }

  console.log("sendMessage - Resposta Z-API parseada:", JSON.stringify(result));

  if (!result.messageId) {
    console.error("sendMessage - messageId ausente na resposta Z-API:", JSON.stringify(result));
    throw new functions.https.HttpsError("internal", "Z-API não retornou messageId");
  }

  // Normalizar messageId para string
  const zapiMessageId = String(result.messageId);

  const msgDocRef = db.collection("conversations").doc(conversationId).collection("messages").doc(messageDocId);
  console.log("sendMessage - Atualizando doc:", msgDocRef.path, "com zapiMessageId:", zapiMessageId);

  // Salvar mapa de roteamento para lookup direto no webhook de status
  const encodedId = encodeURIComponent(zapiMessageId);
  const mapRef = db.collection("zapi_message_map").doc(encodedId);
  console.log("sendMessage - Salvando mapa:", mapRef.path);

  await Promise.all([
    msgDocRef.update({
      zapiMessageId,
      status: "sent",
    }),
    mapRef.set({
      conversationId,
      messageDocId,
      zapiMessageId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }),
    db.collection("conversations").doc(conversationId).update({
      lastMessageStatus: "sent",
      lastMessageZapiMessageId: zapiMessageId,
      lastMessageIsFromMe: true,
    }),
  ]);

  console.log("sendMessage - Sucesso! zaapId:", result.zaapId, "messageId:", zapiMessageId);
  return { zaapId: result.zaapId, messageId: zapiMessageId };
});

export const testConnection = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const config = await getZApiConfig(context.auth.uid);
  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/status`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Client-Token": config.clientToken },
  });

  if (!response.ok) {
    return { connected: false, error: `Status ${response.status}` };
  }

  const result = await response.json() as { connected: boolean; phone?: string };
  return { connected: result.connected, phone: result.phone };
});
