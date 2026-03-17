import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { getZApiConfig } from "./zapiConfig";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const sendLink = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { phone, message, linkUrl, title, linkDescription, image, conversationId, messageDocId } = data;

  console.log("sendLink - Payload recebido:", JSON.stringify({ phone, message, linkUrl, title, linkDescription, imageLength: image?.length, conversationId, messageDocId }));

  if (!phone || !linkUrl || !conversationId || !messageDocId) {
    throw new functions.https.HttpsError("invalid-argument", "phone, linkUrl, conversationId e messageDocId são obrigatórios");
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

  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/send-link`;
  console.log("sendLink - URL Z-API:", url);

  const body: Record<string, string> = { phone, linkUrl };
  if (message) body.message = message;
  if (title) body.title = title;
  if (linkDescription) body.linkDescription = linkDescription;
  if (image) body.image = image;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": config.clientToken,
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  console.log("sendLink - Response status:", response.status, "body:", responseText);

  if (!response.ok) {
    throw new functions.https.HttpsError("internal", `Erro Z-API (${response.status}): ${responseText}`);
  }

  let result: { zaapId?: string; messageId?: string };
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    throw new functions.https.HttpsError("internal", "Resposta Z-API inválida (não é JSON)");
  }

  if (!result.messageId) {
    throw new functions.https.HttpsError("internal", "Z-API não retornou messageId");
  }

  const zapiMessageId = String(result.messageId);
  const msgDocRef = db.collection("conversations").doc(conversationId).collection("messages").doc(messageDocId);
  const encodedId = encodeURIComponent(zapiMessageId);
  const mapRef = db.collection("zapi_message_map").doc(encodedId);

  await Promise.all([
    msgDocRef.update({ zapiMessageId, status: "sent" }),
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

  console.log("sendLink - Sucesso! zaapId:", result.zaapId, "messageId:", zapiMessageId);
  return { zaapId: result.zaapId, messageId: zapiMessageId };
});
