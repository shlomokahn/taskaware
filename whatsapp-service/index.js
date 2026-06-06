require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');

const PORT = process.env.PORT || 3001;
const DJANGO_WEBHOOK_URL = process.env.DJANGO_WEBHOOK_URL || 'http://localhost:8000/api/whatsapp/webhook/';
const WHATSAPP_SERVICE_KEY = process.env.WHATSAPP_SERVICE_KEY || 'taskaware-whatsapp-key-2026';

// 1. Initialize Express App
const app = express();
app.use(express.json({ limit: '50mb' })); // Support large payloads (base64 voice notes)

// 2. Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// 3. WhatsApp Events
client.on('qr', (qr) => {
    console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP ---');
    qrcode.generate(qr, { small: true });
    console.log('---------------------------------------\n');
});

client.on('ready', () => {
    console.log('🚀 WhatsApp client is logged in and ready!');
});

client.on('message', async (msg) => {
    // Only process private chats (exclude groups)
    if (msg.from.endsWith('@g.us')) return;

    const senderNumber = msg.from.split('@')[0];
    console.log(`📩 Received message from ${senderNumber}: ${msg.body || '[Media]'}`);

    const payload = {
        from: senderNumber,
        text: msg.body || ''
    };

    // Handle voice notes / audio messages
    if (msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            if (media && media.mimetype && media.mimetype.startsWith('audio/')) {
                console.log(`🎙️ Voice note detected (${media.mimetype}). Fetching base64 data...`);
                payload.media = {
                    data: media.data, // base64 string
                    mimetype: media.mimetype
                };
            }
        } catch (mediaErr) {
            console.error('Failed to download message media:', mediaErr.message);
        }
    }

    // Forward to Django backend webhook
    try {
        await axios.post(DJANGO_WEBHOOK_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-Whatsapp-Service-Key': WHATSAPP_SERVICE_KEY
            },
            timeout: 30000 // Allow 30 seconds for AI processing
        });
    } catch (err) {
        console.error('Error forwarding message to Django webhook:', err.response?.data || err.message);
    }
});

// 4. API Endpoints
app.post('/send-message', async (req, res) => {
    const key = req.headers['x-whatsapp-service-key'];
    if (key !== WHATSAPP_SERVICE_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { to, text } = req.body;
    if (!to || !text) {
        return res.status(400).json({ success: false, error: 'Missing to or text parameters' });
    }

    try {
        const chatId = `${to}@c.us`;
        await client.sendMessage(chatId, text);
        console.log(`📤 Message sent to ${to}: ${text}`);
        res.json({ success: true });
    } catch (err) {
        console.error(`Failed to send message to ${to}:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Health Check Endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', whatsapp_ready: client.info ? true : false });
});

// Start App and Client
app.listen(PORT, () => {
    console.log(`📡 WhatsApp service listening on port ${PORT}`);
    client.initialize().catch(err => {
        console.error('Failed to initialize WhatsApp client:', err.message);
    });
});
