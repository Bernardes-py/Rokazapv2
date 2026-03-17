import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { getZApiConfig } from "./zapiConfig";

if (!admin.apps.length) admin.initializeApp();

export const sendReaction = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { phone, messageId, emoji } = data;

  if (!phone || !messageId || !emoji) {
    throw new functions.https.HttpsError("invalid-argument", "phone, messageId e emoji são obrigatórios");
  }

  const config = await getZApiConfig(context.auth.uid);

  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/send-reaction`;
  console.log("sendReaction - URL Z-API:", url);

  const response = await fetch(url, {
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

  let result: any;
  try {
    result = JSON.parse(responseText);
  } catch {
    result = { raw: responseText };
  }

  return result;
});
