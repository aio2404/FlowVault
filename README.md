# 🔐 FlowVault

**Le coffre-fort de vos workflows d'automatisation.**

Versioning automatique, diff visuel et rollback en un clic pour **n8n**, **Make**, **Activepieces** et plus encore.

![FlowVault](https://img.shields.io/badge/FlowVault-Workflow%20Versioning-6366F1?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)

---

## 🎯 Pourquoi FlowVault ?

Vous utilisez **n8n**, **Make** ou **Activepieces** ? Vous avez déjà :

- 😱 Cassé un workflow en production sans pouvoir revenir en arrière ?
- 🤔 Oublié ce que vous avez changé la semaine dernière ?
- 😤 Perdu du temps à recréer un workflow supprimé par erreur ?

**FlowVault** résout tout ça :

- 📸 **Snapshots automatiques** de tous vos workflows
- 🔍 **Diff visuel** pour voir exactement ce qui a changé
- ⏪ **Rollback en 1 clic** vers n'importe quelle version
- 🚀 **Promotion Dev → Prod** avec variables d'environnement
- 🔔 **Alertes Slack** en cas de changement ou d'erreur

---

## 🌐 Plateformes supportées

| Plateforme          | Statut     | Description                       |
| ------------------- | ---------- | --------------------------------- |
| ⚡ **n8n**          | ✅ Complet | Open-source workflow automation   |
| 🔮 **Make**         | ✅ Complet | Visual automation (ex-Integromat) |
| 🧩 **Activepieces** | ✅ Complet | Open-source Zapier alternative    |
| ⚡ Zapier           | 🔜 Bientôt | No-code automation                |
| 🔴 Node-RED         | 🔜 Bientôt | Flow-based IoT programming        |
| 🔧 Pipedream        | 🔜 Bientôt | Developer automation              |

---

## 🚀 Quick Start

### Prérequis

- **Node.js** 20+
- **pnpm** 9+ (`npm install -g pnpm`)
- **Docker Desktop** (pour PostgreSQL & Redis)

### Installation

```bash
# 1. Cloner le repo
git clone <repo-url> flowvault
cd flowvault

# 2. Installer les dépendances
pnpm install

# 3. Configurer les variables d'environnement
cp .env.example .env
openssl rand -base64 32 | pbcopy   # macOS (copie la clé)
# Linux : openssl rand -base64 32 | xclip -selection clipboard
# Collez la clé dans APP_ENCRYPTION_KEY

# 4. Lancer Docker Desktop, puis démarrer les services
cd infra && docker compose up -d postgres redis
cd ..

# 5. Configurer la base de données
pnpm db:push
pnpm db:seed

# 6. Lancer l'application
pnpm dev
```

### 🎉 C'est prêt !

- **Web App** : http://localhost:3000
- **API** : http://localhost:3001

### Compte démo

Après `pnpm db:seed`, utilisez :

- **Email** : `demo@flowvault.dev`
- Cliquez sur le lien magique dans les logs du terminal

---

## 📁 Structure du projet

```
flowvault/
├── apps/
│   ├── api/              # API Fastify (TypeScript)
│   │   └── src/lib/platforms/  # Adaptateurs multi-plateforme
│   ├── web/              # Frontend Next.js 14
│   └── mock-n8n/         # Mock n8n pour le dev local
├── packages/
│   └── shared/           # Types partagés
├── infra/
│   └── docker-compose.yml
└── docs/
    └── README.md         # Documentation détaillée
```

---

## 🔧 Commandes utiles

| Commande         | Description                          |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Lance tous les services (web + api)  |
| `pnpm build`     | Build de production                  |
| `pnpm db:push`   | Sync le schéma Prisma avec la DB     |
| `pnpm db:seed`   | Injecte les données de démo          |
| `pnpm db:studio` | Ouvre Prisma Studio (GUI pour la DB) |

---

## 🐳 Docker

### Démarrer les services

```bash
cd infra
docker compose up -d postgres redis
```

### Arrêter les services

```bash
cd infra
docker compose down
```

### Reset complet (efface les données)

```bash
cd infra
docker compose down -v
docker compose up -d postgres redis
cd ../apps/api && pnpm db:push && pnpm db:seed
```

### Déploiement cloud (AWS)

- Lis le guide [Platform & Infrastructure](docs/platform/README.md) pour l’architecture cible, les environnements et les estimations de coûts.
- Les manifests Terraform vivent dans `infra/terraform`. Copie `terraform.tfvars.example`, renseigne ton compte AWS puis exécute `terraform init && terraform apply`.
- Utilise Ansible (`infra/ansible`) pour lancer les migrations Prisma, pousser les secrets dans SSM ou exécuter le smoke test (`playbooks/smoke-test.yml`) juste après chaque déploiement.

---

## ✨ Fonctionnalités

### Core

- 📸 **Snapshots automatiques** - Capture silencieuse des workflows
- 🔍 **Diff visuel** - Voir les changements node par node
- ⏪ **Rollback** - Restaurer n'importe quelle version en 1 clic
- 📊 **Monitoring** - Dashboard de santé et erreurs cross-instances

### Multi-plateforme

- 🔌 **Architecture adaptateurs** - Support n8n, Make, Activepieces
- 🌍 **Multi-instances** - Gérer plusieurs instances depuis un seul dashboard
- 🔄 **Sync global** - Synchroniser les erreurs de toutes les instances

### DevOps

- 🚀 **Promotion Dev→Prod** - Passer un workflow entre environnements
- 📝 **Variables** - Stocker des configs par environnement
- 🔐 **Sécurisé** - Clés API chiffrées AES-256-GCM
- 🔔 **Alertes Slack** - Notifications de changements
- 📣 **Notifications multi-canal** - Slack, email, Teams ou webhooks personnalisés

---

## 🏗️ Architecture Multi-Plateforme

```
┌─────────────────────────────────────────┐
│           FlowVault (Core)              │
│  Versioning • Diff • Rollback • Errors  │
└────────────────┬────────────────────────┘
                 │
    ┌────────────┼────────────┬───────────┐
    │            │            │           │
┌───▼───┐  ┌─────▼─────┐  ┌───▼────┐  ┌───▼───┐
│  n8n  │  │   Make    │  │ Active │  │  ...  │
│       │  │           │  │ pieces │  │       │
└───────┘  └───────────┘  └────────┘  └───────┘
```

Chaque plateforme implémente l'interface `IAutomationPlatform` :

```typescript
import { createPlatformAdapter } from "./platforms";

// Créer un adaptateur pour n'importe quelle plateforme
const adapter = createPlatformAdapter({
  type: "n8n", // ou 'make', 'activepieces'
  baseUrl: "http://localhost:5678",
  apiKey: "your-api-key",
});

// API unifiée
const workflows = await adapter.listWorkflows();
const executions = await adapter.listExecutions();
```

---

## 📖 Documentation complète

Voir [`docs/README.md`](./docs/README.md) pour :

- API endpoints
- Architecture détaillée
- Guide de déploiement
- Et plus...

---

## 💰 Business Model (idées)

| Plan     | Prix mensuel | Instances incluses | Workflows suivis | Idéal pour                                             |
| -------- | ------------ | ------------------ | ---------------- | ------------------------------------------------------ |
| **Free** | $0           | 1                  | 2                | Side project, démo interne                             |
| **Pro**  | $39          | 5                  | 25               | Équipe produit qui exploite n8n en production          |
| **Team** | $99          | 15                 | 100              | Agences/scale-ups multi-clients avec monitoring avancé |

- Chaque plan inclut le diff visuel, rollback, alertes Slack et promotion Dev→Prod.
- Au-delà des quotas, possibilité d’ajouter des crédits (instances/workflows) ou basculer sur une offre Enterprise (VPC dédié, SSO, support 24/7).

### Estimation coûts AWS

| Offre                | Description                                                                                                   | Coût mensuel estimé |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| **Starter**          | 1 tâche Fargate (ou EC2 t3.small), RDS t4g.micro mono-AZ, Redis autogéré, 50 Go de trafic                     | **60‑80 $**         |
| **Prod résiliente**  | 3 tâches Fargate (API/Web/worker) + ALB, RDS t4g.small multi-AZ, ElastiCache, CloudFront/S3 IA, 200 Go trafic | **270‑300 $**       |
| **Enterprise privé** | Déploiement dédié (VPC isolé, support 24/7, monitoring avancé, stockage long terme)                           | **>500 $**          |

> Ces montants incluent compute, base Postgres, stockage snapshots, monitoring CloudWatch et transferts sortants. Ajuste selon ton trafic réel (snapshots, volume S3, nombre d'instances suivies).

---

## 📝 License

MIT

---

<p align="center">
  <strong>FlowVault</strong> - Never lose a workflow again 🔐
</p>
