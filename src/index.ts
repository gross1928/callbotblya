import { initSentry, captureException } from './utils/sentry';
import { startBot } from './bot';
import express from 'express';
import { handleYooKassaWebhook } from './handlers/payment';

// Initialize Sentry for error tracking (should be first)
initSentry();

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
    message: 'ЗаЕдаю Telegram Bot is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ЮKassa webhook endpoint for payment notifications
app.post('/webhook/yookassa', async (req, res) => {
  try {
    console.log('[ЮKassa Webhook] ===== RECEIVED NOTIFICATION =====');
    console.log('[ЮKassa Webhook] Headers:', JSON.stringify(req.headers));
    console.log('[ЮKassa Webhook] Body:', JSON.stringify(req.body, null, 2));
    console.log('[ЮKassa Webhook] Timestamp:', new Date().toISOString());
    
    await handleYooKassaWebhook(req.body);
    
    console.log('[ЮKassa Webhook] ===== PROCESSING COMPLETED =====');
    res.status(200).send('OK');
  } catch (error) {
    console.error('[ЮKassa Webhook] ===== ERROR PROCESSING WEBHOOK =====');
    console.error('[ЮKassa Webhook] Error:', error);
    
    // Report to Sentry
    captureException(error as Error, {
      webhook: 'yookassa',
      body: req.body,
    });
    
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
  
  // Report to Sentry
  captureException(error as Error, {
    context: 'bot_startup',
  });
  
  process.exit(1);
});
