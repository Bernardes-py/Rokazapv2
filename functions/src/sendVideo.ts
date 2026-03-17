import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { getZApiConfig } from "./zapiConfig";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const sendVideo = functions.runWith({ timeoutSeconds: 120, memory: "512MB" }).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { phone, caption, conversationId, messageDocId } = data;
  const video: string = data.video || "";

  console.log("sendVideo - Payload recebido:", JSON.stringify({ phone, captionLength: caption?.length, conversationId, messageDocId, videoLength: video?.length }));

  if (!phone || !video || !conversationId || !messageDocId) {
    throw new functions.https.HttpsError("invalid-argument", "phone, video, conversationId e messageDocId são obrigatórios");
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

  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/send-video`;
  console.log("sendVideo - URL Z-API:", url);

  const body: Record<string, string> = { phone, video };
  if (caption) body.caption = caption;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": config.clientToken,
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  console.log("sendVideo - Response status:", response.status, "body:", responseText);

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

  console.log("sendVideo - Sucesso! zaapId:", result.zaapId, "messageId:", zapiMessageId);
  return { zaapId: result.zaapId, messageId: zapiMessageId };
});
