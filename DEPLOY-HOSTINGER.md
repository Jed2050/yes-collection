# GID DEPLWAMAN — GITHUB → HOSTINGER NODE.JS (an Kreyòl)

> Sa a se gid pou ou pibliye **YES COLLECTION** kòm yon **Node.js Application** sou Hostinger.
> Sit la se Express ki sevi tout fichye estatik yo + 2 endpoint API (`/api/contact`, `/api/order`).

---

## ETAP 1 · Repo lokal la (DEJA FÈT)

Repo `git` ak premye komit yo deja fèt. Tcheke:
```bash
cd "C:/Users/vicyolde/Downloads/YES-COLLECTION"
git log --oneline
```

Repo GitHub la: **https://github.com/Jed2050/yes-collection**

---

## ETAP 2 · Konfigirasyon Lokal (Tès)

Anvan ou pouse modifikasyon, ou ka teste'l lokalman:
```bash
cd "C:/Users/vicyolde/Downloads/YES-COLLECTION"
npm install
npm start
```
Site la ap mache sou `http://localhost:3000`.

---

## ETAP 3 · Konekte Hostinger ak GitHub

### 3.1 — Konekte kont yo
1. Konekte sou **https://hpanel.hostinger.com**
2. Chwazi sit ou
3. Nan menu lateral: **Avansé → GitHub**
4. Klike **Connect GitHub Account** → otorize Hostinger

### 3.2 — Lyaj repo a (NODE.JS APP)
1. Toujou nan **Avansé → GitHub**, klike **Create New Repository Connection**
2. Chwazi:
   - **Repository:** `Jed2050/yes-collection`
   - **Branch:** `main`
   - **Install path:** `/domains/[domèn-ou]/public_html` (oswa `/yes-collection` si ou prefere yon dosye separe — gade etap 4)
3. Klike **Connect**

Hostinger pral klone repo a otomatikman.

---

## ETAP 4 · Konfigure Node.js Application

Sa a se etap kle a — Hostinger pa konnen sit la se Node.js otomatikman, ou bezwen di'l.

1. Nan hPanel, chwazi sit la
2. Menu lateral: **Avansé → Node.js**
3. Klike **Create Application**
4. Ranpli:
   - **Node.js version:** `20.x` (oswa pi resan ki disponib)
   - **Application mode:** `Production`
   - **Application root:** chemen kote Hostinger te klone repo a (egz: `domains/yescollection.com/public_html`)
   - **Application URL:** domèn ou (egz: `yescollection.com`)
   - **Application startup file:** `server.js`
5. Klike **Create**

Hostinger pral:
- Detekte `package.json`
- Kouri `npm install` otomatikman
- Lanse `node server.js` ak `process.env.PORT` ki konfigire

### 4.1 — Variables Environnement
Toujou nan paj **Node.js**, anba a, gen yon seksyon **Environment Variables**. Ajoute:
- `NODE_ENV` = `production`

(`PORT` la, Hostinger fikse'l otomatikman — pa toche'l.)

---

## ETAP 5 · Aktive SSL

1. hPanel → **SSL** → **Install Free SSL** (Let's Encrypt)
2. Tann 5-10 min pou aktivasyon
3. `server.js` la deja fòse HTTPS otomatikman an pwodiksyon (gade `IS_PROD` nan kòd la)

---

## ETAP 6 · Tcheke

1. Vizite `https://yescollection.com` (oswa domèn ou)
2. Tcheke API health: `https://yescollection.com/api/health` → ta dwe retounen `{"status":"ok"}`
3. Si pa mache:
   - hPanel → **Avansé → Node.js** → klike **Restart**
   - Tcheke logs nan menm paj la (klike **Logs** anba a)

---

## ETAP 7 · Workflow Lavi

Pou modifye sit la apre li deplwaye:

```bash
# 1. Modifye fichye yo (egz: chanje pri yon pwodwi nan products.js)
cd "C:/Users/vicyolde/Downloads/YES-COLLECTION"

# 2. Komit + push
git add -A
git commit -m "deskripsyon chanjman an"
git push
```

### Deploy chanjman yo sou Hostinger
GitHub push la pa redeploy otomatikman. Pou aktive nouvo kòd la:

**Manyèl:**
1. hPanel → **Avansé → GitHub** → wè repo a → klike **Deploy Latest Changes**
2. hPanel → **Avansé → Node.js** → klike **Restart Application**

**Otomatik (pi rekòmande):**
1. Nan paj GitHub Connection an, ou ap wè yon **Webhook URL**
2. Kopi'l
3. GitHub: **repo → Settings → Webhooks → Add webhook**
4. Kole URL la, content type `application/json`, trigger `Just the push event`

Apre sa, chak push sou `main` ap auto-deploy. Men ou toujou bezwen klike **Restart Application** apre pou Node a pran nouvo kòd la (Hostinger UI gen yon opsyon "Auto-restart on file changes" ou ka aktive).

---

## STRIKTI FICHYE

```
yes-collection/                    ← repo GitHub + dosye Hostinger
├── server.js                      ← STARTUP FILE (Express)
├── package.json                   ← npm depandans
├── package-lock.json
├── .gitignore                     ← ignore node_modules
├── index.html, collection.html, product.html, cart.html, about.html, contact.html, 404.html
├── .htaccess                      ← BACKUP (sou Apache only — Node.js pa itilize'l)
├── robots.txt, sitemap.xml
├── DEPLOY-HOSTINGER.md (sa a)
├── README.md
└── assets/
    ├── css/styles.css
    └── js/
        ├── products.js
        ├── cart.js
        └── main.js
```

**Nòt sou `.htaccess`:** Sou Hostinger Node.js, Apache pa sevi sit la dirèkteman — Node.js sevi tout. `.htaccess` la rete pou backup nan ka ou ta vle deplwaye sou yon plan estatik.

---

## API ENDPOINTS DISPONIB

`server.js` ekspoze 3 endpoints (anplis fichye estatik yo):

| Method | URL | Itilizasyon |
|---|---|---|
| `GET`  | `/api/health` | Health check (Hostinger uptime monitoring) |
| `POST` | `/api/contact` | Soumèt fòm kontak — pou kounye a li loge nan konsòl Hostinger |
| `POST` | `/api/order` | Soumèt yon kòmand — pou kounye a li loge sèlman |

**Pou ekstanse:** Modifye `server.js`. Pou voye email, ajoute `nodemailer`:
```bash
npm install nodemailer
```
Apre konekte ak SMTP Hostinger ou (hPanel → **Email Accounts**) pou voye konfimasyon kòmand.

---

## DEPANAJ

### "Cannot find module 'express'"
Hostinger pa fè `npm install`. Tcheke:
1. `package.json` egziste nan **Application root** la
2. Klike **Run NPM Install** nan paj Node.js la

### "Application failed to start"
1. Tcheke **Logs** nan paj Node.js
2. Verifye **Application startup file** se `server.js` (pa `index.js`)
3. Verifye Node version se 18+ (kòd la sèvi ak features modèn)

### Site la lwè men ASSETS yo (CSS/JS) pa lwè
Tcheke chemen yo nan HTML yo (`assets/css/styles.css`, `assets/js/main.js`) — yo ta dwe relatif, san `/` devan. Sa deja konfigire kòrèkteman.

### Domèn pa konekte
1. hPanel → **Domèn** → tcheke domèn nan pwente sou bon **Application URL**
2. DNS A record dwe pwente sou IP Hostinger w (chèche'l nan **DNS Zone Editor**)

### Imaj Unsplash pa lwè
Imaj nan `index.html` ak `products.js` sevi ak Unsplash CDN. Sa mache, men ou ta pi byen:
1. Telecharje vrè foto pwodwi yo
2. Mete yo nan `assets/img/products/`
3. Chanje URLs nan `assets/js/products.js` pou itilize chemen lokal yo (egz: `assets/img/products/royal-noir-1.jpg`)
4. Komit + push

---

## CHECKLIST AVAN LANSE

Anvan ou bay kliyan adrès la:

- [ ] Chanje `WA_NUMBER` nan `assets/js/cart.js` (vrè nimewo WhatsApp ou, san `+`)
- [ ] Chanje email/telefòn/adrès nan tout `*.html` (`+509 0000 0000`, `contact@yescollection.com`, etc.)
- [ ] Ranplase imaj Unsplash yo ak vrè foto kostim (mete yo nan `assets/img/products/`)
- [ ] Mete vrè domèn nan `robots.txt` ak `sitemap.xml`
- [ ] Aktive SSL Let's Encrypt
- [ ] Teste fòm kontak la (vrè soumisyon)
- [ ] Teste cart + WhatsApp checkout
- [ ] Tcheke `/api/health` ap reponn
- [ ] Tcheke responsive (mobile + desktop)
