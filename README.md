# Fruit Market DApp

**TP3 — IFT-4100/7100 : Concepts et applications de la chaine de blocs**  
Marketplace decentralisee pour acheter et vendre des fruits sur Ethereum.

---

## Theme choisi

**Fruit Market** — marketplace decentralisee pour acheter/vendre des produits.

---

## Architecture

```
+------------------------+       +----------------+       +-----------------+
|   Frontend             |------>|  UUPS Proxy    |------>| FruitMarketV1   |
|  (HTML/CSS/JS)         |       |  (ERC-1967)    |       |  ou V2          |
|  + ethers.js v6        |       +----------------+       +-----------------+
|  + MetaMask            |               |
+------------------------+        Reseau : Sepolia
```

- **Contrats** : Solidity 0.8.24, OpenZeppelin Upgradeable (UUPS)
- **Framework** : Hardhat
- **Frontend** : HTML/CSS/JS + ethers.js v6 + Google Fonts + Unsplash images
- **Reseau** : Ethereum Sepolia Testnet

---

## Fonctionnalites

### V1 — Marketplace de base

- Ajouter, modifier et retirer des produits (controle d'acces par vendeur)
- Acheter des produits avec paiement en ETH (transfert direct au vendeur)
- Protection contre la reentrance (guard manuel, compatible proxy)
- Pattern Checks-Effects-Interactions
- Remboursement automatique du surplus de paiement
- Custom errors pour optimiser le gas

### V2 — Systeme d'evaluation (apres upgrade)

- Evaluation des vendeurs (note 1-5 + commentaire)
- Un acheteur ne peut evaluer un vendeur qu'une seule fois
- Note moyenne calculee on-chain
- L'etat de V1 est integralement conserve apres l'upgrade

### Frontend

- Design moderne inspire OpenSea/Uniswap (glassmorphism, animations fluides)
- Photos reelles des fruits via Unsplash (16+ fruits supportes, FR et EN)
- Panel de detail slide-in au clic sur un produit avec images, informations detaillees, et evaluations completes incluant les commentaires et adresses des evaluateurs
- Panier persistant (localStorage) avec badge compteur dans la barre de navigation, controles de quantite (+/-), total en ETH, et checkout multi-articles
- Avatars colores generes a partir des adresses wallet
- Detection automatique du reseau et gestion d'erreurs complete (transaction rejetee, fonds insuffisants, produit indisponible, etc.)
- Toasts de notification (succes, erreur, info)
- Connexion MetaMask avec rechargement automatique au changement de compte ou de reseau

---

## Prerequis

- Node.js >= 18 (et < 22 recommande pour eviter les warnings Hardhat)
- MetaMask (extension navigateur)
- Un compte Alchemy ou Infura (gratuit, pour l'URL RPC Sepolia)
- ETH de test sur Sepolia

---

## Installation

### Etape 1 — Cloner le depot

```bash
git clone https://github.com/Yaassinee/ProjectDapps.git
cd ProjectDapps
npm install
```

### Etape 2 — Configurer le fichier .env

```bash
cp .env.example .env
```

Ouvrir le fichier `.env` avec un editeur (`nano .env`, `code .env`, etc.) et remplir les variables suivantes.

#### PRIVATE_KEY — cle privee MetaMask

Cette cle permet au script Hardhat de signer des transactions sur Sepolia.

1. Ouvrir MetaMask dans le navigateur
2. Cliquer sur les trois points en haut a droite
3. Account details puis Show private key
4. Entrer votre mot de passe MetaMask
5. Copier la cle (commence par 0x) et la coller apres `PRIVATE_KEY=`

**Important** : ne jamais partager cette cle. Ne jamais la commit sur GitHub. Le fichier `.env` est deja dans `.gitignore` et ne sera pas pousse.

**Conseil** : creer un compte MetaMask separe uniquement pour ce TP, avec seulement de l'ETH de test. En cas de fuite de la cle, aucun fonds reel n'est en danger.

#### SEPOLIA_RPC_URL — URL RPC pour le reseau Sepolia

Cette URL permet a Hardhat de se connecter au reseau Sepolia.

1. Creer un compte gratuit sur Alchemy (https://www.alchemy.com/) ou Infura (https://infura.io/)
2. Creer une nouvelle application : Chain = Ethereum, Network = Sepolia
3. Copier l'URL HTTPS fournie par le service
4. Coller l'URL complete apres `SEPOLIA_RPC_URL=`

Exemple :
```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/votre_cle_api_ici
```

#### Obtenir de l'ETH de test sur Sepolia

Votre compte MetaMask doit avoir de l'ETH de test pour payer le gas des transactions. Utiliser l'un des faucets suivants :

- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://faucet.quicknode.com/ethereum/sepolia

Coller votre adresse MetaMask dans le faucet et recevoir environ 0.5 ETH de test (largement suffisant pour le TP).

#### PROXY_ADDRESS — laisser vide pour le moment

Cette variable sera remplie apres le premier deploiement (voir section Deploiement ci-dessous).

#### ETHERSCAN_API_KEY — optionnel

Utile uniquement pour verifier le contrat sur Etherscan (bonus). Peut rester vide.

### Etape 3 — Verifier l'installation

```bash
npx hardhat compile
```

Si la compilation se termine sans erreur, l'installation est reussie.

---

## Tests

```bash
npx hardhat test
```

17 tests automatises couvrant les scenarios suivants :

1. Deploiement du contrat (adresse non nulle, owner correct, version v1)
2. Ajout d'un fruit (nom, prix, stock corrects, evenement emis, validations des entrees)
3. Achat d'un fruit (transfert de fonds au vendeur, stock mis a jour, achat enregistre, remboursement du surplus)
4. Achat avec fonds insuffisants — la transaction revert et l'etat reste coherent
5. Mise a jour d'un produit avec controle d'acces (seul le vendeur peut modifier)
6. Suppression d'un produit (desactivation par le vendeur)
7. Upgrade V1 vers V2 : deploiement via proxy, action en V1, upgrade, verification que l'etat est conserve et que la nouvelle fonctionnalite (evaluations) est disponible, verification de l'anti-doublon

Les tests utilisent un reseau Hardhat local. Aucune cle privee ni ETH de test ne sont necessaires pour les executer.

---

## Deploiement sur Sepolia

**Important** : suivre les etapes dans l'ordre. Le script d'upgrade necessite la variable `PROXY_ADDRESS` dans `.env`, qui est obtenue apres le script de deploiement.

### Etape 1 — Deployer V1

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Sortie attendue :
```
Proxy deploye a     : 0xABC...123
Implementation (V1) : 0xDEF...456
Version             : v1
```

### Etape 2 — Copier l'adresse du proxy dans .env

**Sans cette etape, l'upgrade echouera** avec l'erreur suivante :
```
Error: PROXY_ADDRESS manquant dans .env — executez d'abord le script de deploy.
```

Ouvrir `.env` et remplir la variable `PROXY_ADDRESS` avec l'adresse du proxy affichee a l'etape 1 :
```
PROXY_ADDRESS=0xABC...123
```

Sauvegarder le fichier.

### Etape 3 — Upgrade vers V2

```bash
npx hardhat run scripts/upgrade.js --network sepolia
```

Le script effectue automatiquement les operations suivantes avant l'upgrade :
- Nettoyage du cache et des artefacts de compilation
- Recompilation complete des contrats
- Detection et importation automatique du proxy si le manifest OpenZeppelin est absent (cas d'un repo clone)

Sortie attendue :
```
Nettoyage du cache pour garantir une compilation fraiche...
Recompilation des contrats...
Compiled 11 Solidity files successfully.
Version actuelle      : v1
--------------------------------------
Proxy (inchange)        : 0xABC...123
Nouvelle implementation : 0xGHI...789
Version apres upgrade   : v2
--------------------------------------
```

### Etape 4 — Configurer le frontend

Dans le fichier `frontend/index.html`, localiser la ligne suivante :
```js
const CONTRACT_ADDRESS = "PASTE_YOUR_PROXY_ADDRESS_HERE";
```

Remplacer la valeur par l'adresse du proxy deployee a l'etape 1.

---

## Lancement du frontend

```bash
npx http-server frontend -p 3000
```

1. Ouvrir http://localhost:3000 dans Chrome
2. Connecter MetaMask sur le reseau Sepolia
3. Naviguer dans les onglets : Catalogue, Vendre, Mes produits, Evaluer (V2 uniquement)
4. Cliquer sur un produit pour ouvrir le panel de detail avec les evaluations
5. Cliquer sur l'icone panier dans la barre de navigation pour acceder au panier

### Guide d'utilisation

En tant que vendeur :
- Onglet Vendre : entrer le nom du fruit, le prix en ETH, et le stock, puis cliquer sur "Mettre en vente"
- Onglet Mes produits : modifier le prix ou le stock d'un produit existant, ou le retirer du marche

En tant qu'acheteur :
- Catalogue : achat direct via le bouton "Acheter", ou ajout au panier via le bouton panier
- Cliquer sur une carte produit pour voir les details complets et les evaluations du vendeur
- Ouvrir le panier, ajuster les quantites si necessaire, puis cliquer sur "Passer a l'achat" (une transaction MetaMask par article avec indication de progression)

Evaluation (V2 uniquement) :
- Onglet Evaluer : coller l'adresse complete du vendeur, choisir une note de 1 a 5, ajouter un commentaire, puis envoyer
- Les evaluations s'affichent ensuite dans le panel de detail de chaque produit du vendeur concerne
- Un acheteur ne peut evaluer un vendeur qu'une seule fois
- Un vendeur ne peut pas s'evaluer lui-meme

---

## Informations de deploiement

| Element | Detail |
|---|---|
| Reseau | Ethereum Sepolia Testnet |
| Proxy | 0xaA2dF7549C3E0547C296D917753077F7A67BC172 |
| Implementation V1 | 0x0De9E7cC252ccFBBBf176cD88276c5a934a38f61 |
| Implementation V2 | 0x524999f71Af9e2b02d872764d40623f2DA3451B1 |
| Explorateur | https://sepolia.etherscan.io/address/0xaA2dF7549C3E0547C296D917753077F7A67BC172 |

---

## Securite

- OwnableUpgradeable : seul le owner peut upgrader le contrat via la fonction _authorizeUpgrade
- Reentrancy Guard manuel : implemente directement dans le contrat sans constructeur, compatible avec le pattern proxy UUPS, protege la fonction buyProduct
- Checks-Effects-Interactions : le stock est deduit avant le transfert d'ETH au vendeur
- Custom errors : erreurs explicites et gas-efficient (InsufficientPayment, NotTheSeller, AlreadyRated, CannotRateSelf, etc.)
- Validations d'entrees : nom non vide, prix strictement positif, quantite strictement positive, score entre 1 et 5
- Anti-doublon : un acheteur ne peut evaluer un vendeur qu'une seule fois, enforce par le mapping hasRated
- Anti auto-evaluation : un vendeur ne peut pas s'evaluer lui-meme
- Aucune cle privee dans le code source : toutes les variables sensibles sont dans le fichier .env qui est exclu du versionnement via .gitignore

---

## Structure du projet

```
fruit-market-dapp/
|-- contracts/
|   |-- FruitMarketV1.sol     Contrat principal (marketplace + reentrancy guard)
|   |-- FruitMarketV2.sol     Upgrade : systeme d'evaluation des vendeurs
|-- test/
|   |-- FruitMarket.test.js   Suite de tests (17 tests)
|-- scripts/
|   |-- deploy.js             Deploiement V1 via proxy UUPS
|   |-- upgrade.js            Upgrade V1 vers V2 (auto-clean + forceImport)
|-- frontend/
|   |-- index.html            Interface utilisateur complete (SPA vanilla)
|-- hardhat.config.js
|-- package.json
|-- .env.example              Template de configuration (a copier en .env)
|-- .gitignore
|-- README.md
```

---

## Technologies utilisees

| Composant | Technologie |
|---|---|
| Smart contracts | Solidity 0.8.24 |
| Framework | Hardhat |
| Proxy pattern | UUPS (OpenZeppelin Upgrades) |
| Librairie frontend | ethers.js v6 |
| Wallet | MetaMask |
| Reseau | Ethereum Sepolia |
| Fonts | Plus Jakarta Sans (Google Fonts) |
| Images | Unsplash (CDN) |
| Persistance locale | localStorage (panier) |

---

## Depannage

**PROXY_ADDRESS manquant dans .env**  
Cette erreur apparait si le script upgrade.js est execute avant deploy.js. Executer d'abord le deploiement, copier l'adresse du proxy dans .env, puis relancer l'upgrade.

**Insufficient funds au deploiement**  
Le compte MetaMask sur Sepolia n'a pas assez d'ETH pour payer le gas. Utiliser un faucet pour obtenir de l'ETH de test (voir section Installation).

**Warning Node.js version**  
Hardhat recommande Node.js 18 a 22. Les versions plus recentes (24, 25) fonctionnent generalement mais affichent un avertissement. Cet avertissement peut etre ignore.

**Error HH502 Couldn't download compiler**  
Probleme reseau temporaire avec les serveurs de telechargement du compilateur Solidity. Reessayer apres quelques minutes.

**Upgrade retourne v1 au lieu de v2**  
Le script upgrade.js nettoie automatiquement le cache et importe le proxy si necessaire. Si le probleme persiste malgre tout, executer manuellement :
```bash
rm -rf cache artifacts .openzeppelin
npx hardhat compile
npx hardhat run scripts/upgrade.js --network sepolia
```

**Mauvais reseau dans le frontend**  
Changer MetaMask vers le reseau Sepolia Test Network. Si le reseau n'apparait pas dans MetaMask, l'ajouter manuellement via https://chainlist.org en cherchant Sepolia.

**Erreur de chargement dans le catalogue**  
Verifier que l'adresse du contrat dans frontend/index.html correspond bien a l'adresse du proxy deploye. Verifier egalement que MetaMask est connecte au bon reseau.

---

## Auteurs

Yassine EL Moumen - Maitrise en informatique, Universite Laval  
Gaoussou KONATE - Maitrise en informatique, Universite Laval
IFT-7100 - Hiver 2026
