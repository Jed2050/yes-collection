# GID DEPLWAMAN — GITHUB → HOSTINGER (an Kreyòl)

> Sa a se gid pou ou pibliye **YES COLLECTION** sou Hostinger atravè GitHub.
> Avantaj: chak fwa ou push yon chanjman sou GitHub, Hostinger pral mete sit la ajou otomatikman.

---

## ETAP 1 · Prepare Repo lokal la (DEJA FÈT)

Repo `git` deja inisyalize ak premye komit la fèt. Tcheke:
```bash
cd "C:/Users/vicyolde/Downloads/YES-COLLECTION"
git log --oneline
```

---

## ETAP 2 · Konekte GitHub

Ou bezwen yon kont GitHub gratis sou https://github.com.

### Opsyon A · GitHub CLI (rekòmande)
```bash
"C:\Program Files\GitHub CLI\gh.exe" auth login --web --hostname github.com --git-protocol https
```
Suiv enstriksyon yo:
1. Chwazi **GitHub.com**
2. Chwazi **HTTPS**
3. Chwazi **Login with a web browser**
4. Kopi kòd la (8 chif)
5. Peze Enter → navigatè ouvri
6. Antre kòd la, otorize, fini.

### Opsyon B · Personal Access Token (si Opsyon A pa mache)
1. Ale sou https://github.com/settings/tokens/new
2. Note: "YES Collection deploy"
3. Scopes: koche `repo` ak `workflow`
4. Klike **Generate token** → kopi token an
5. Sove'l yon kote — ou pa ka wè'l ankò

---

## ETAP 3 · Kreye Repo + Pouse Kòd

Apre ou autentifye, kouri:
```bash
cd "C:/Users/vicyolde/Downloads/YES-COLLECTION"
"C:\Program Files\GitHub CLI\gh.exe" repo create yes-collection \
  --public \
  --source=. \
  --remote=origin \
  --description "YES Collection — Bespoke menswear atelier storefront" \
  --push
```

Sa pral:
- Kreye yon repo nouvo `yes-collection` sou kont GitHub ou
- Konekte repo lokal la ak GitHub
- Pouse tout kòd la

Verifye sou: `https://github.com/<username-ou>/yes-collection`

---

## ETAP 4 · Konekte Hostinger ak GitHub

Hostinger gen yon **GitHub integration** ki klone repo a otomatikman e ki déploye nouvo komit yo.

### 4.1 — Konekte kont yo
1. Konekte sou **hpanel.hostinger.com**
2. Chwazi sit ou (oswa kreye yon nouvo si poko gen)
3. Nan menu lateral: **Avansé → GitHub**
4. Klike **Connect GitHub Account**
5. Otorize Hostinger — sa ou wè nan navigatè a, klike **Authorize Hostinger**

### 4.2 — Lyaj repo a
1. Toujou nan **Avansé → GitHub**, klike **Create New Repository Connection**
2. Chwazi:
   - **Repository:** `<username-ou>/yes-collection`
   - **Branch:** `main`
   - **Install path:** `/public_html` (sa se vrè wèb root la)
3. Klike **Connect**

Hostinger pral klone repo a nan `public_html/`. Premye fwa a li ka pran 1-2 minit.

### 4.3 — Tcheke
Ale sou domèn ou (egzanp `https://yescollection.com`) — ou ta dwe wè sit la ap mache.

**ENPÒTAN:** Si ou wè 404, verifye:
- `index.html` egziste nan `public_html/` (pa nan yon sou-dosye)
- `.htaccess` egziste tou
- SSL certificate aktive (hPanel → SSL → enstale)

---

## ETAP 5 · Mete Sit la Ajou (Workflow Lavi)

Apre tout sa fèt, lavi a senp:

```bash
# Modifye nenpòt fichye (egz: chanje pri yon pwodwi nan products.js)
git -C "C:/Users/vicyolde/Downloads/YES-COLLECTION" add -A
git -C "C:/Users/vicyolde/Downloads/YES-COLLECTION" commit -m "Mete pri Royal Noir Tuxedo ajou"
git -C "C:/Users/vicyolde/Downloads/YES-COLLECTION" push
```

### Manyèl deploy nan Hostinger
Push GitHub la ap pouse kòd la, MEN Hostinger pa toujou auto-pull. Pou di Hostinger pull:
1. hPanel → **Avansé → GitHub**
2. Wè repo ou nan lis la → klike **Deploy Latest Changes**

### Webhook auto-deploy (opsyonèl)
Pou Hostinger fè pull otomatik chak push:
1. Nan paj GitHub repo → **Settings → Webhooks → Add webhook**
2. Hostinger pral ba ou yon URL webhook nan paj GitHub Connection an. Kole'l la.
3. Content type: `application/json`
4. Trigger: **Just the push event**

Kounye a chak push push yo ap auto-deploy.

---

## DEPANAJ

### "Permission denied (publickey)"
GitHub Credential Manager poko save token an. Re-kouri `gh auth login` oswa konfigure manyèlman:
```bash
git config --global credential.helper manager
```

### Hostinger pa wè repo
Verifye Hostinger gen pèmisyon sou repo a:
- GitHub → **Settings → Applications → Authorized OAuth Apps → Hostinger**
- Asire repo a apparèt nan lis "Repository access"

### Imaj Unsplash pa lwè (production)
Imaj nan `index.html` ak `products.js` sevi ak Unsplash CDN. Sa mache, men ou ta pi byen:
1. Telecharje vrè foto pwodwi yo
2. Mete yo nan `assets/img/products/`
3. Chanje URLs nan `assets/js/products.js` pou itilize chemen lokal yo (egz: `assets/img/products/royal-noir-1.jpg`)
4. Commit + push

### `.htaccess` pa parèt nan File Manager
Hostinger File Manager kache fichye ki kòmanse ak `.` pa default. Aktive **Settings → Show Hidden Files**.

---

## FILE STRUCTURE (rapèl)

```
yes-collection/                    ← repo GitHub
├── index.html, collection.html, ...
├── .htaccess                      ← Hostinger HTTPS + clean URLs
├── assets/css, assets/js
└── public_html/                   ← (sou Hostinger sèlman, otomatik)
```

Hostinger klone tout repo a nan `public_html/`. Tout fichye nan rasin repo a vin disponib sou domèn ou.
