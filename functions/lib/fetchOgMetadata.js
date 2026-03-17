"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchOgMetadata = void 0;
const functions = __importStar(require("firebase-functions"));
const node_fetch_1 = __importDefault(require("node-fetch"));
exports.fetchOgMetadata = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { url } = data;
    if (!url || typeof url !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "URL é obrigatória");
    }
    console.log("fetchOgMetadata - Buscando:", url);
    let html;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
                "Accept": "text/html",
            },
        });
        clearTimeout(timeout);
        html = await response.text();
    }
    catch (err) {
        console.log("fetchOgMetadata - Erro ao buscar URL:", err.message);
        return { title: "", description: "", image: "" };
    }
    let title = "";
    let description = "";
    let image = "";
    // Try OG meta tags (support both property and name, and both attribute orders)
    const ogRegex = /<meta\s+[^>]*(?:property|name)=["']og:(title|description|image)["'][^>]*content=["']([^"']+)["'][^>]*\/?>/gi;
    const ogRegexReverse = /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:(title|description|image)["'][^>]*\/?>/gi;
    let match;
    while ((match = ogRegex.exec(html)) !== null) {
        const key = match[1].toLowerCase();
        if (key === "title" && !title)
            title = match[2];
        if (key === "description" && !description)
            description = match[2];
        if (key === "image" && !image)
            image = match[2];
    }
    while ((match = ogRegexReverse.exec(html)) !== null) {
        const key = match[2].toLowerCase();
        if (key === "title" && !title)
            title = match[1];
        if (key === "description" && !description)
            description = match[1];
        if (key === "image" && !image)
            image = match[1];
    }
    // Fallback: <title>
    if (!title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch)
            title = titleMatch[1].trim();
    }
    // Fallback: <meta name="description">
    if (!description) {
        const descMatch = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*\/?>/i)
            || html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*\/?>/i);
        if (descMatch)
            description = descMatch[1].trim();
    }
    console.log("fetchOgMetadata - Resultado:", { title: title.substring(0, 50), description: description.substring(0, 50), image: image.substring(0, 80) });
    return { title, description, image };
});
//# sourceMappingURL=fetchOgMetadata.js.map