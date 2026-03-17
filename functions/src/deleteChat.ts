import * as functions from "firebase-functions";
import fetch from "node-fetch";
import { getZApiConfig } from "./zapiConfig";

export const deleteChat = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { phone } = data;
  console.log("deleteChat - Payload recebido:", JSON.stringify({ phone }));

  if (!phone) {
    throw new functions.https.HttpsError("invalid-argument", "phone é obrigatório");
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

  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/modify-chat`;
  console.log("deleteChat - URL Z-API:", url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": config.clientToken,
    },
    body: JSON.stringify({ phone, action: "delete" }),
  });

  const responseText = await response.text();
  console.log("deleteChat - Response status:", response.status, "body:", responseText);

  if (!response.ok) {
    throw new functions.https.HttpsError("internal", `Erro Z-API (${response.status}): ${responseText}`);
  }

  let result: any;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    result = { value: true };
  }

  console.log("deleteChat - Sucesso!");
  return { success: true, ...result };
});
