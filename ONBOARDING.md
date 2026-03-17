# Síndico X — Guia de Onboarding de Novo Cliente

Este guia descreve o passo a passo para criar uma nova instância do Síndico X para um condomínio cliente.

---

## Pré-requisitos

- [Node.js 20+](https://nodejs.org/) instalado
- [Firebase CLI](https://firebase.google.com/docs/cli) instalado (`npm install -g firebase-tools`)
- Acesso ao código-fonte do projeto (via GitHub)
- Conta Google com acesso ao [Firebase Console](https://console.firebase.google.com/)

---

## 1. Criar Projeto Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com/)
2. Clique em **Adicionar projeto**
3. Dê um nome ao projeto (ex: `sindicox-condoabc`)
4. Desative o Google Analytics (opcional) e clique em **Criar projeto**

### 1.1 Ativar Authentication

1. No menu lateral, vá em **Authentication → Get started**
2. Ative o provedor **E-mail/senha**
3. Crie o primeiro usuário admin em **Users → Add user**

### 1.2 Ativar Cloud Firestore

1. Vá em **Firestore Database → Create database**
2. Selecione a região mais próxima (ex: `southamerica-east1` para Brasil)
3. Inicie em **modo de produção** (as regras serão deployadas depois)

### 1.3 Ativar Storage

1. Vá em **Storage → Get started**
2. Inicie em **modo de produção**

### 1.4 Copiar credenciais

1. Vá em **Configurações do projeto** (ícone de engrenagem) → **Geral**
2. Em **Seus apps**, clique em **Adicionar app** → **Web** (ícone `</>`)
3. Dê um apelido (ex: `sindicox-web`) e registre
4. Copie os valores do `firebaseConfig` — você vai precisar deles no passo 3

---

## 2. Deploy das Cloud Functions

```bash
# Clone o repositório (se ainda não tiver)
git clone <URL_DO_REPOSITORIO>
cd <PASTA_DO_PROJETO>

# Autentique no Firebase
firebase login

# Selecione o novo projeto
firebase use <ID_DO_PROJETO>
# Ex: firebase use sindicox-condoabc

# Instale dependências das functions
cd functions
npm install

# Compile e faça deploy das functions + regras do Firestore
cd ..
firebase deploy --only functions,firestore:rules
```

### 2.1 Verificar deploy

No Firebase Console → **Functions**, confirme que todas as funções aparecem (zapiWebhook, sendMessage, createUser, etc.)

---

## 3. Configurar variáveis de ambiente (.env)

Na raiz do projeto, crie um arquivo `.env` com as credenciais do novo projeto:

```bash
# Copie o template
cp .env.example .env
```

Preencha com os valores copiados no passo 1.4:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=sindicox-condoabc.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sindicox-condoabc
VITE_FIREBASE_STORAGE_BUCKET=sindicox-condoabc.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## 4. Build e Deploy do Frontend

```bash
# Instale dependências (se necessário)
npm install

# Gere o build de produção
npm run build

# Deploy no Firebase Hosting do cliente
firebase deploy --only hosting
```

O site estará disponível em `https://<ID_DO_PROJETO>.web.app`

---

## 5. Configurar Domínio Personalizado (opcional)

### Opção A: Subdomínio do sindicox.com.br

1. No Firebase Console → **Hosting → Adicionar domínio personalizado**
2. Adicione `condoabc.sindicox.com.br`
3. O Firebase fornecerá registros DNS (tipo A) para configurar
4. No painel da Locaweb (ou registrador DNS):
   - Adicione um registro **A** para `condoabc` apontando para o IP fornecido pelo Firebase
5. Aguarde propagação DNS (até 72h)
6. O Firebase provisionará SSL automaticamente

### Opção B: Domínio próprio do condomínio

Se o cliente tiver domínio próprio (ex: `gestao.condoabc.com.br`):
1. Siga o mesmo processo acima, adicionando o domínio no Firebase Hosting
2. Configure os registros DNS no registrador do cliente

---

## 6. Configurar Z-API (WhatsApp)

1. Acesse [z-api.io](https://z-api.io/) e crie uma nova instância
2. Faça login na plataforma Síndico X do novo cliente
3. Vá em **Configurações → Z-API**
4. Preencha:
   - **Instance ID**: ID da instância Z-API
   - **Instance Token**: Token da instância
   - **Client Token**: Token do cliente Z-API
5. Escaneie o QR Code para conectar o WhatsApp
6. Configure o **Webhook de recebimento** na Z-API apontando para:
   ```
   https://<REGIAO>-<ID_DO_PROJETO>.cloudfunctions.net/zapiWebhook
   ```

---

## 7. Configuração Inicial do Sistema

Após o primeiro login como admin:

1. **Criar usuários** — Cadastre os atendentes em Configurações → Usuários
2. **Configurar chatbot** (opcional) — Ative e configure respostas automáticas
3. **Importar contatos** (opcional) — Via integração Superlogica ou manualmente

---

## Checklist Final

- [ ] Projeto Firebase criado com Auth, Firestore e Storage ativos
- [ ] Cloud Functions deployadas e funcionando
- [ ] Regras do Firestore deployadas
- [ ] Frontend buildado com `.env` correto e hospedado
- [ ] Domínio configurado e SSL ativo
- [ ] Z-API conectada com webhook configurado
- [ ] Usuário admin criado e logando com sucesso
- [ ] Primeiro teste de envio/recebimento de mensagem WhatsApp

---

## Estrutura Multi-Tenant

```
www.sindicox.com.br              → Site institucional
lopesx.sindicox.com.br           → Firebase "rokazap" (Lopes X)
condoabc.sindicox.com.br         → Firebase "sindicox-condoabc"
condoxyz.sindicox.com.br         → Firebase "sindicox-condoxyz"
```

Cada instância é **100% independente**: banco de dados, autenticação, WhatsApp e hosting separados. O código-fonte é o mesmo — apenas a configuração muda.

---

## Suporte

Em caso de dúvidas, entre em contato com a equipe de desenvolvimento.
