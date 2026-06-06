# TaskAware WhatsApp Service (Proxy Bot)

A lightweight Node.js gateway that connects TaskAware to WhatsApp using `whatsapp-web.js`. It runs a headless Chromium browser instance to act as a WhatsApp Web client, forwarding incoming messages/audio to your Django backend, and exposing an API to let Django send messages back.

---

## ⚙️ Configuration (`.env`)

Create a `.env` file in this directory:

```env
PORT=3001
DJANGO_WEBHOOK_URL=https://your-django-backend.com/api/whatsapp/webhook/
WHATSAPP_SERVICE_KEY=your-secure-shared-key-2026
```

---

## 💻 Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Service
```bash
npm start
```

### 3. Scan QR Code
When the server starts, it will print a QR code in the console. 
- Open WhatsApp on your phone.
- Go to **Linked Devices** -> **Link a Device**.
- Scan the console QR code.

Once logged in, it will save authentication data in a local folder called `.wwebjs_auth/` so you do not need to scan again next time.

---

## ☁️ Deploying to the Cloud

The service is containerized using Docker, which is the most reliable way to run Puppeteer in headless environments (since it installs Chromium and all necessary system libraries automatically).

### Option A: Koyeb (Recommended Free Tier)
1. Register on [Koyeb](https://www.koyeb.com/).
2. Click **Create Service** -> Choose **GitHub** as the source.
3. Select your repository.
4. Set the **Build Type** to **Docker** (it will auto-detect the `Dockerfile` inside the `whatsapp-service` directory. Specify the subdirectory path in Koyeb configuration if needed, or put this repo folder in its own git repo).
5. Add the Environment Variables:
   - `PORT=8000` (Koyeb default port)
   - `DJANGO_WEBHOOK_URL=https://<your-django-app>.render.com/api/whatsapp/webhook/`
   - `WHATSAPP_SERVICE_KEY=<your-secret-key>`
6. Deploy! Open the app URL or deployment logs in Koyeb to see and scan the QR code.

### Option B: Fly.io
1. Install Fly CLI.
2. Run `fly launch` in this directory.
3. Configure ports and variables.
4. Run `fly deploy`.
5. Check logs using `fly logs` to scan the QR code.
