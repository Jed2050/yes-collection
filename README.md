# YES COLLECTION — Bespoke Atelier Storefront

> Elevated. Refined. Set Apart.

A complete luxury e-commerce storefront for **YES COLLECTION**, a bespoke menswear atelier (tuxedos, three-piece suits, dinner jackets, wedding pieces, accessories).

**Architecture:** Express (Node.js 18+) serving static HTML / CSS / JavaScript with API routes for contact + order intake. Designed for **Hostinger Node.js Application Manager**.

---

## QUICKSTART (LOCAL)

```bash
npm install
npm start              # http://localhost:3000
```

For deployment instructions, see **`DEPLOY-HOSTINGER.md`** (Kreyòl).

---

## STRUCTURE

```
YES-COLLECTION/
├── server.js             ← Express server (STARTUP FILE for Hostinger)
├── package.json          ← Dependencies
├── index.html            ← Home / Maison
├── collection.html       ← Full catalog with filters
├── product.html          ← Product detail (uses ?id=)
├── cart.html             ← Shopping cart + WhatsApp checkout
├── about.html            ← Atelier story
├── contact.html          ← Booking form
├── 404.html              ← Custom not-found page
├── .htaccess             ← BACKUP for static fallback (Apache only)
├── robots.txt
├── sitemap.xml
├── DEPLOY-HOSTINGER.md   ← Deploy guide (Kreyòl)
└── assets/
    ├── css/styles.css    ← Complete design system
    ├── js/products.js    ← Product catalog (edit here to add/change products)
    ├── js/cart.js        ← LocalStorage cart logic
    └── js/main.js        ← UX (drawer, reveals, page renderers)
```

---

## SERVER FEATURES

`server.js` provides:

- **Static file serving** with smart caching (HTML no-cache, assets 1 year immutable)
- **Clean URLs**: `/collection` resolves `collection.html`, `/product?id=…`, etc.
- **HTTPS + www→root redirects** in production
- **Compression** (gzip)
- **Helmet** security headers
- **API routes**:
  - `GET /api/health` → service health check
  - `POST /api/contact` → contact form intake
  - `POST /api/order` → order intake (alternative to WhatsApp checkout)
- **Custom 404** page

---

## DEPLOYMENT — HOSTINGER NODE.JS

Full guide in `DEPLOY-HOSTINGER.md`. Summary:

1. **GitHub:** `Jed2050/yes-collection` (already pushed)
2. **hPanel → Avansé → GitHub** → connect → link repo to `/public_html`
3. **hPanel → Avansé → Node.js** → Create Application:
   - Node version: `20.x`
   - Mode: `Production`
   - Startup file: `server.js`
   - Application root: where Hostinger cloned the repo
4. **hPanel → SSL** → install Let's Encrypt
5. Visit your domain.

### Optional: Static-only fallback

If you ever need static-only hosting, the `.htaccess` is preserved with HTTPS forcing, clean URLs, caching, and security headers — drop the folder on any Apache shared hosting and it runs without Node.
4. Delete the zip

### Method 3 · FTP

Use FileZilla with your Hostinger FTP credentials (hPanel → FTP Accounts). Upload all files to `public_html/`.

---

## CRITICAL CONFIG — BEFORE GOING LIVE

Edit these placeholders before showing the site to clients:

| File | Line / Variable | What to change |
|---|---|---|
| `assets/js/cart.js` | `WA_NUMBER = '50900000000'` | Real WhatsApp number, **no `+`** (e.g. `50912345678`) |
| `contact.html` | `+509 0000 0000` (multiple) | Real phone |
| `contact.html` | `contact@yescollection.com` | Real email |
| `contact.html` | `Rue de l'Élégance, N° 7` | Real address |
| All HTML files (footer) | Phone & email in footer | Real contact info |
| `sitemap.xml` | `yescollection.com` | Your real domain |
| `robots.txt` | `yescollection.com` | Your real domain |
| `assets/js/main.js` | `mailto:contact@yescollection.com` | Real email for contact form |

### Quick sed (Git Bash / WSL)
```bash
cd YES-COLLECTION
sed -i 's/yescollection\.com/yourdomain.com/g' robots.txt sitemap.xml
sed -i 's/contact@yescollection\.com/your@email.com/g' assets/js/main.js *.html
sed -i 's/+509 0000 0000/+509 1234 5678/g' *.html
sed -i "s/50900000000/50912345678/g" assets/js/cart.js
```

---

## EDITING PRODUCTS

Open `assets/js/products.js`. Each product is an object in the `YES_PRODUCTS` array:

```js
{
  id: 'unique-slug',          // used in URLs: product.html?id=unique-slug
  name: 'Product Name',
  category: 'tuxedo',         // must match a category id
  categoryLabel: 'Tuxedo',
  price: 1250,                // numbers; 0 = "On request"
  badge: 'Signature',         // null for none
  images: ['url1', 'url2', 'url3'],
  short: 'One-line description for cards',
  description: 'Full PDP description.',
  fabric: 'Italian Super 130s wool',
  color: 'Midnight Black',
  sizes: ['44', '46', '48', '50', '52'],
  features: ['Bullet 1', 'Bullet 2'],
}
```

**To add real product photos**: upload them to `assets/img/products/` via Hostinger File Manager, then reference like `assets/img/products/royal-noir-1.jpg` in the `images` array.

---

## CHECKOUT FLOW

The site uses a **WhatsApp checkout** — not a real payment processor:

1. Client adds items to cart (saved in browser LocalStorage)
2. On `/cart`, click **Complete Order via WhatsApp**
3. WhatsApp opens with a pre-filled order message (items, sizes, quantities, total)
4. Concierge confirms manually within 24 hours

This is intentional for a luxury bespoke brand where every order requires fitting + custom work. If you later want **Stripe / PayPal**, you would need a backend (Hostinger supports PHP) or a service like **Snipcart** (drop-in JS).

---

## TYPOGRAPHY

- **Cinzel** — display headlines (matches the logo's roman serif)
- **Cormorant Garamond** — italic accents, lede paragraphs, product names
- **Plus Jakarta Sans** — UI / body / small text

All loaded from Google Fonts via `<link>` — no installation needed.

---

## DESIGN SYSTEM

Open `assets/css/styles.css`. The first 60 lines define the entire system as CSS variables:

- **Colors**: gold scale (`--gold-50` → `--gold-600`), surfaces, hairlines
- **Typography**: font stacks
- **Motion**: cubic-bezier curves, durations
- **Radii**: card corner sizes

Change a variable, the entire site updates.

---

## BROWSER SUPPORT

Chrome / Safari / Firefox / Edge — last 2 versions.
Mobile-first responsive (works down to 360px width).

---

## LICENSE

© 2025 YES Collection. All rights reserved.
