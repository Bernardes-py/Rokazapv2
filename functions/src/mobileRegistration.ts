import * as functions from "firebase-functions";
import fetch from "node-fetch";
import { getZApiConfig } from "./zapiConfig";

export const checkRegistrationAvailable = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { ddi, phone } = data;
  if (!ddi || !phone) {
    throw new functions.https.HttpsError("invalid-argument", "ddi e phone são obrigatórios");
  }

  const config = await getZApiConfig(context.auth.uid);
  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/mobile/registration-available`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": config.clientToken,
    },
    body: JSON.stringify({ ddi, phone }),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error("checkRegistrationAvailable erro:", response.status, result);
    throw new functions.https.HttpsError("internal", `Erro Z-API (${response.status})`);
  }

  return result;
});

export const requestRegistrationCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { ddi, phone, method } = data;
  if (!ddi || !phone || !method) {
    throw new functions.https.HttpsError("invalid-argument", "ddi, phone e method são obrigatórios");
  }

  const config = await getZApiConfig(context.auth.uid);
  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/mobile/request-registration-code`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": config.clientToken,
    },
    body: JSON.stringify({ ddi, phone, method }),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error("requestRegistrationCode erro:", response.status, result);
  }

  // Retorna sempre o resultado (pode conter captcha, retryAfter, banned, etc.)
  return result;
});

export const confirmRegistrationCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { code } = data;
  if (!code) {
    throw new functions.https.HttpsError("invalid-argument", "code é obrigatório");
  }

  const config = await getZApiConfig(context.auth.uid);
  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/mobile/confirm-registration-code`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": config.clientToken,
    },
    body: JSON.stringify({ code }),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error("confirmRegistrationCode erro:", response.status, result);
  }

  return result;
});

export const respondCaptcha = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { captcha } = data;
  if (!captcha) {
    throw new functions.https.HttpsError("invalid-argument", "captcha é obrigatório");
  }

  const config = await getZApiConfig(context.auth.uid);
  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/mobile/respond-captcha`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": config.clientToken,
    },
    body: JSON.stringify({ captcha }),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error("respondCaptcha erro:", response.status, result);
  }

  return result;
});
