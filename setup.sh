#!/bin/bash

# ============================================================
# Síndico X — Script de Setup para Novo Cliente
# Uso: ./setup.sh <firebase-project-id>
# Exemplo: ./setup.sh sindicox-condoabc
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
err()  { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

# --- Validações ---

if [ -z "$1" ]; then
  echo ""
  echo "Uso: ./setup.sh <firebase-project-id>"
  echo "Exemplo: ./setup.sh sindicox-condoabc"
  echo ""
  exit 1
fi

PROJECT_ID="$1"
ENV_FILE=".env.${PROJECT_ID}"

command -v firebase >/dev/null 2>&1 || err "Firebase CLI não encontrado. Instale com: npm install -g firebase-tools"
command -v node >/dev/null 2>&1 || err "Node.js não encontrado. Instale em: https://nodejs.org/"

echo ""
echo "============================================"
echo "  Síndico X — Deploy para: ${PROJECT_ID}"
echo "============================================"
echo ""

# --- Passo 1: Verificar .env do cliente ---

if [ ! -f "$ENV_FILE" ]; then
  warn "Arquivo ${ENV_FILE} não encontrado."
  echo ""
  echo "Crie o arquivo ${ENV_FILE} com as credenciais Firebase do cliente:"
  echo ""
  echo "  cp .env.example ${ENV_FILE}"
  echo "  # Edite ${ENV_FILE} com os valores do projeto Firebase"
  echo ""
  exit 1
fi

ok "Arquivo ${ENV_FILE} encontrado"

# Validar que todas as variáveis estão preenchidas
while IFS='=' read -r key value; do
  [[ "$key" =~ ^#.*$ ]] && continue
  [[ -z "$key" ]] && continue
  if [ -z "$value" ]; then
    err "Variável ${key} está vazia em ${ENV_FILE}. Preencha antes de continuar."
  fi
done < "$ENV_FILE"

ok "Todas as variáveis de ambiente estão preenchidas"

# --- Passo 2: Selecionar projeto Firebase ---

log "Selecionando projeto Firebase: ${PROJECT_ID}"
firebase use "$PROJECT_ID" || err "Falha ao selecionar projeto. Verifique se o projeto existe e você tem acesso."
ok "Projeto ${PROJECT_ID} selecionado"

# --- Passo 3: Deploy das Cloud Functions + Regras ---

log "Instalando dependências das Cloud Functions..."
cd functions
npm install
cd ..
ok "Dependências instaladas"

log "Fazendo deploy das Cloud Functions e regras do Firestore..."
firebase deploy --only functions,firestore:rules
ok "Functions e regras deployadas"

# --- Passo 4: Build do frontend ---

log "Instalando dependências do frontend..."
npm install
ok "Dependências instaladas"

log "Copiando ${ENV_FILE} para .env..."
cp "$ENV_FILE" .env

log "Gerando build de produção..."
npm run build
ok "Build concluído"

# --- Passo 5: Deploy do Hosting ---

log "Fazendo deploy do Firebase Hosting..."
firebase deploy --only hosting
ok "Hosting deployado"

# --- Resumo ---

echo ""
echo "============================================"
echo -e "  ${GREEN}Deploy concluído com sucesso!${NC}"
echo "============================================"
echo ""
echo "  Projeto:  ${PROJECT_ID}"
echo "  URL:      https://${PROJECT_ID}.web.app"
echo ""
echo "  Próximos passos:"
echo "  1. Configure o domínio personalizado no Firebase Console"
echo "  2. Crie o usuário admin em Authentication"
echo "  3. Configure a Z-API na plataforma"
echo "  4. Consulte ONBOARDING.md para detalhes"
echo ""
