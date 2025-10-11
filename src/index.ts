import { startBot } from './bot';
import express from 'express';
import { handleYooKassaWebhook } from './handlers/payment';

// Create simple HTTP server for health checks
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'ДаЕда Telegram Bot is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ЮKassa webhook endpoint for payment notifications
app.post('/webhook/yookassa', async (req, res) => {
  try {
    console.log('[ЮKassa Webhook] Received notification:', JSON.stringify(req.body));
    await handleYooKassaWebhook(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('[ЮKassa Webhook] Error processing webhook:', error);
    res.status(500).send('Error');
  }
});

// Start HTTP server
app.listen(port, () => {
  console.log(`HTTP server running on port ${port}`);
});

// Start the bot
startBot().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
