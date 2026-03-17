import * as functions from "firebase-functions";
import fetch from "node-fetch";

export const fetchOgMetadata = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { url } = data;
  if (!url || typeof url !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "URL é obrigatória");
  }

  console.log("fetchOgMetadata - Buscando:", url);

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      signal: controller.signal as any,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
        "Accept": "text/html",
      },
    });
    clearTimeout(timeout);
    html = await response.text();
  } catch (err: any) {
    console.log("fetchOgMetadata - Erro ao buscar URL:", err.message);
    return { title: "", description: "", image: "" };
  }

  let title = "";
  let description = "";
  let image = "";

  // Try OG meta tags (support both property and name, and both attribute orders)
  const ogRegex = /<meta\s+[^>]*(?:property|name)=["']og:(title|description|image)["'][^>]*content=["']([^"']+)["'][^>]*\/?>/gi;
  const ogRegexReverse = /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:(title|description|image)["'][^>]*\/?>/gi;

  let match: RegExpExecArray | null;
  while ((match = ogRegex.exec(html)) !== null) {
    const key = match[1].toLowerCase();
    if (key === "title" && !title) title = match[2];
    if (key === "description" && !description) description = match[2];
    if (key === "image" && !image) image = match[2];
  }
  while ((match = ogRegexReverse.exec(html)) !== null) {
    const key = match[2].toLowerCase();
    if (key === "title" && !title) title = match[1];
    if (key === "description" && !description) description = match[1];
    if (key === "image" && !image) image = match[1];
  }

  // Fallback: <title>
  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) title = titleMatch[1].trim();
  }

  // Fallback: <meta name="description">
  if (!description) {
    const descMatch = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*\/?>/i)
      || html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*\/?>/i);
    if (descMatch) description = descMatch[1].trim();
  }

  console.log("fetchOgMetadata - Resultado:", { title: title.substring(0, 50), description: description.substring(0, 50), image: image.substring(0, 80) });
  return { title, description, image };
});
