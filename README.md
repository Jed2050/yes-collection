# YES COLLECTION — Bespoke Atelier Storefront

> Elevated. Refined. Set Apart.

A complete static luxury e-commerce storefront for **YES COLLECTION**, a bespoke menswear atelier (tuxedos, three-piece suits, dinner jackets, wedding pieces, accessories).

Built as pure HTML / CSS / JavaScript — **no build step, no Node, no database**. Drop the folder on Hostinger and it runs.

---

## STRUCTURE

```
YES-COLLECTION/
├── index.html            ← Home / Maison
├── collection.html       ← Full catalog with filters
├── product.html          ← Product detail (uses ?id=)
├── cart.html             ← Shopping cart + WhatsApp checkout
├── about.html            ← Atelier story
├── contact.html          ← Booking form
├── 404.html              ← Custom not-found page
├── .htaccess             ← Hostinger config (HTTPS, cache, clean URLs)
├── robots.txt
├── sitemap.xml
└── assets/
    ├── css/styles.css    ← Complete design system
    ├── js/products.js    ← Product catalog (edit here to add/change products)
    ├── js/cart.js        ← LocalStorage cart logic
    └── js/main.js        ← UX (drawer, reveals, page renderers)
```

---

## DEPLOYMENT — HOSTINGER

### Method 1 · File Manager (easiest)

1. Log into **hpanel.hostinger.com**
2. Open your hosting plan → **File Manager**
3. Navigate to `public_html/`
4. **Delete** the default `default.php` / `index.html` if present
5. Select **all files** inside `YES-COLLECTION/` (not the folder itself — its contents) and **drag-drop** into `public_html/`
   - Make sure `.htaccess` is included (enable "Show hidden files" in File Manager settings)
6. Done. Visit your domain.

### Method 2 · ZIP upload

1. Zip the **contents** of `YES-COLLECTION/` (not the folder itself)
2. In File Manager → Upload → upload the zip into `public_html/`
3. Right-click the zip → **Extract**
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
