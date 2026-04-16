# Fruit Market DApp

**TP3 — IFT-4100/7100 : Concepts et applications de la chaîne de blocs**  
Marketplace décentralisée pour acheter et vendre des fruits sur Ethereum.

---

## Thème choisi

**Fruit Market** — marketplace décentralisée pour acheter/vendre des produits.

## Architecture

```
┌───────────────────────┐       ┌───────────────┐       ┌────────────────┐
│   Frontend             │──────▶│  UUPS Proxy   │──────▶│ FruitMarketV1  │
│  (HTML/CSS/JS)         │       │  (ERC-1967)   │       │  ou V2         │
│  + ethers.js v6        │       └───────────────┘       └────────────────┘
│  + MetaMask            │               │
└───────────────────────┘        Réseau : Sepolia
```

- **Contrats** : Solidity 0.8.24, OpenZeppelin Upgradeable (UUPS)
- **Framework** : Hardhat
- **Frontend** : HTML/CSS/JS + ethers.js v6 + Google Fonts + Unsplash images
- **Réseau** : Ethereum Sepolia Testnet

---

## Fonctionnalités

### V1 — Marketplace de base
- Ajouter, modifier et retirer des produits (contrôle d'accès par vendeur)
- Acheter des produits avec paiement en ETH (transfert direct au vendeur)
- Protection contre la réentrance (guard manuel, compatible proxy)
- Pattern Checks-Effects-Interactions
- Remboursement automatique du surplus de paiement
- Custom errors pour optimiser le gas

### V2 — Système d'évaluation (après upgrade)
- Évaluation des vendeurs (note 1-5 + commentaire)
- Un acheteur ne peut évaluer un vendeur qu'une seule fois
- Note moyenne calculée on-chain
- Panel de détail avec affichage des commentaires et adresses des évaluateurs
- **L'état de V1 est intégralement conservé après l'upgrade**

### Frontend
- Design moderne inspiré OpenSea/Uniswap (glassmorphism, animations)
- Photos réelles des fruits via Unsplash (16+ fruits supportés, FR et EN)
- Panel de détail slide-in au clic sur un produit (infos + achats + évaluations)
- Avatars colorés générés à partir des adresses wallet
- Détection automatique du réseau et gestion d'erreurs complète
- Connexion MetaMask avec rechargement automatique au changement de compte

---

## Prérequis

- **Node.js** >= 18
- **MetaMask** (ou wallet compatible)
- ETH de test sur Sepolia (faucet : https://sepoliafaucet.com/)

---

## Installation

```bash
git clone https://github.com/Yaassinee/ProjectDapps.git
cd ProjectDapps

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env
# ⚠️ Remplir .env avec votre clé privée et URL RPC
```

---

## Compilation

```bash
npx hardhat compile
```

---

## Tests

```bash
npx hardhat test
```

Les tests couvrent :
1. **Déploiement** du contrat (adresse non nulle, owner correct, version v1)
2. **Ajout d'un fruit** (nom/prix/stock corrects, événement émis, validations)
3. **Achat** (transfert de fonds au vendeur, stock mis à jour, achat enregistré, remboursement surplus)
4. **Achat avec fonds insuffisants** → revert propre
5. **Mise à jour de produit** avec contrôle d'accès (seul le vendeur peut modifier)
6. **Suppression de produit** (désactivation par le vendeur)
7. **Upgrade V1 → V2** : état conservé + nouvelle fonctionnalité (ratings) disponible + anti-doublon vérifié

**Total : 17 tests automatisés.**

---

## Déploiement sur Sepolia

### 1. Déployer V1

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Copier l'adresse du proxy dans `.env` (variable `PROXY_ADDRESS`).

### 2. Upgrade vers V2

```bash
npx hardhat clean
npx hardhat compile
npx hardhat run scripts/upgrade.js --network sepolia
```

### 3. Configurer le frontend

Dans `frontend/index.html`, remplacer :
```js
const CONTRACT_ADDRESS = "PASTE_YOUR_PROXY_ADDRESS_HERE";
```
par l'adresse du proxy déployé.

---

## Lancement du frontend

```bash
# Ouvrir directement dans le navigateur ou avec un serveur local :
npx http-server frontend -p 3000
```

1. Ouvrir `http://localhost:3000` dans Chrome
2. Connecter MetaMask sur le réseau Sepolia
3. Naviguer dans les onglets : Catalogue / Vendre / Mes produits / Évaluer (V2)
4. Cliquer sur un produit pour ouvrir le panel de détail avec les évaluations

---

## Informations de déploiement

| Élément | Détail |
|---|---|
| **Réseau** | Ethereum Sepolia Testnet |
| **Proxy** | `0xaA2dF7549C3E0547C296D917753077F7A67BC172` |
| **Explorateur** | [Voir sur Etherscan](https://sepolia.etherscan.io/address/0xaA2dF7549C3E0547C296D917753077F7A67BC172) |

---

## Sécurité

- **OwnableUpgradeable** : seul le owner peut upgrader le contrat via `_authorizeUpgrade`
- **Reentrancy Guard manuel** : implémenté sans constructeur (compatible proxy UUPS), protège `buyProduct`
- **Checks-Effects-Interactions** : le stock est déduit AVANT le transfert d'ETH
- **Custom errors** : erreurs explicites et gas-efficient (`InsufficientPayment`, `NotTheSeller`, etc.)
- **Validations d'entrées** : nom non vide, prix > 0, quantité > 0, score entre 1 et 5
- **Anti-doublon** : un acheteur ne peut évaluer un vendeur qu'une seule fois
- **Pas de clé privée dans le code** : tout est dans `.env` (non versionné via `.gitignore`)

---

## Structure du projet

```
fruit-market-dapp/
├── contracts/
│   ├── FruitMarketV1.sol     # Contrat principal (marketplace + reentrancy guard)
│   └── FruitMarketV2.sol     # Upgrade : système d'évaluation vendeurs
├── test/
│   └── FruitMarket.test.js   # Suite de tests (17 tests)
├── scripts/
│   ├── deploy.js             # Déploiement V1 via proxy UUPS
│   └── upgrade.js            # Upgrade V1 → V2
├── frontend/
│   └── index.html            # Interface utilisateur complète
├── hardhat.config.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Technologies utilisées

| Composant | Technologie |
|---|---|
| Smart contracts | Solidity 0.8.24 |
| Framework | Hardhat |
| Proxy pattern | UUPS (OpenZeppelin) |
| Librairie frontend | ethers.js v6 |
| Wallet | MetaMask |
| Réseau | Ethereum Sepolia |
| Fonts | Plus Jakarta Sans (Google Fonts) |
| Images | Unsplash (CDN) |

---

## Auteur

**Yassine** — Maîtrise en informatique, Université Laval  
IFT-4100/7100 — Hiver 2026
