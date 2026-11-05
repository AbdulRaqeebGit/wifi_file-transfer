# ⚡ AR | WiFi | TR — Serverless P2P File, Text & Link Transfer

> **Direct Device-to-Device WebRTC transfer for Files, Text Messages, and Links over Wi-Fi, Mobile Hotspot, 4G/5G, or Internet. 100% Hostable on GitHub Pages without any backend server!**

---

## ✨ Features (خصوصیات)

1. 🌐 **GitHub Pages Hostable (Serverless P2P):**
   - Poori app 100% static client-side React code par chal sakti hai. Kisi Node.js backend server ki zaroorat nahi!
2. 💬 **Text / Notes Transfer (نئے فیچرز):**
   - Clipboard text, notes, passwords, OTPs ya lambi messages kisi bhi device par ek click mein send karein.
   - Recipient ke paas foran 1-click **Copy** button ke saath display hota hai.
3. 🔗 **Link / URL Attach Option (نئے فیچرز):**
   - Koi bhi website link, YouTube video, Google Drive link ya article attach karke send karein.
   - Doosri device par foran **Open** aur **Copy Link** ka option aata hai.
4. 📶 **Laptop Wi-Fi Band Ho To Solution:**
   - Ab agar router ka Wi-Fi band ho, tab bhi transfer hoga:
     - **Option A:** Mobile ka **Personal Hotspot** on karein aur laptop connect karein.
     - **Option B:** Laptop ka **Mobile Hotspot** on karke phone connect karein.
     - **Option C:** Agar phone mobile data (4G/5G) par ho aur laptop kisi dusre internet par ho, tab bhi WebRTC global P2P direct connect kar deta hai!
5. 📦 **Unlimited File Size:**
   - 64KB WebRTC chunking + backpressure handling. Choti files se le kar 5GB+ 4K videos tak transfer hoti hain.
6. 🔟 **Max 10 Files / Batch:**
   - Ek batch mein 10 files select ya drag & drop karke foran transfer karein.
7. ⬇️ **Single File Download & 🗜️ Download All (ZIP):**
   - Individual download button + Client-side JSZip ke zariye saari files ek single ZIP file mein download karne ka option.
8. 📱 **QR Code Mobile Connect:**
   - QR Code scan karte hi phone par web app khul kar laptop ke sath **auto-pair** ho jati hai.
9. ⚪ **Simple Flat White & Red Theme:**
   - Clean white background, no busy gradients, solid `#BC0202` buttons and crisp UI.

---

## 🚀 How to Host on GitHub Pages (گٹ ہب پر ہوسٹ کرنے کا طریقہ)

### Method 1: Using GitHub Web
1. GitHub par nayi repository banayein (e.g. `wifi-file-transfers`).
2. Is project ke **`dist`** folder ke andar mojood files (`index.html`, `assets/`, `favicon.svg`) ko repo mein upload kar dein.
3. Repository ki **Settings** ➔ **Pages** mein ja kar **Branch: main / root** select karke Save karein.
4. Aapki app `https://<your-username>.github.io/<repo-name>/` par live ho jayegi!

### Method 2: Git Command Line
```bash
# Production bundle banayein:
npm run build

# dist folder ko gh-pages branch par push karein:
npx gh-pages -d dist
```

---

## 💻 Local Run (اپنے کمپیوٹر پر چلانے کا طریقہ)

```bash
# Terminal mein:
npm start
# Ya double-click karein:
start-transfer.bat
```
Browser mein open karein: `http://localhost:5000` ya `http://localhost:5173`.
