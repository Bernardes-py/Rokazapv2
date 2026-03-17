import * as functions from "firebase-functions";
import fetch from "node-fetch";
import { getZApiConfig } from "./zapiConfig";

export const blockContact = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { phone, action } = data as {
    phone: string;
    action: "block" | "unblock";
  };

  if (!phone || !action) {
    throw new functions.https.HttpsError("invalid-argument", "phone e action são obrigatórios");
  }

  if (action !== "block" && action !== "unblock") {
    throw new functions.https.HttpsError("invalid-argument", "action deve ser 'block' ou 'unblock'");
  }

  const config = await getZApiConfig(context.auth.uid);

  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/contacts/modify-blocked`;

  console.log("blockContact - URL:", url, "phone:", phone, "action:", action);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": config.clientToken,
    },
    body: JSON.stringify({ phone, action }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new functions.https.HttpsError("internal", `Erro Z-API: ${res.status} - ${text}`);
  }

  return await res.json();
});
