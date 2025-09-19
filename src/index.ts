import { startBot } from './bot';
import express from 'express';

// Create simple HTTP server for health checks
const app = express();
const port = process.env.PORT || 3000;

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

// Start HTTP server
app.listen(port, () => {
  console.log(`HTTP server running on port ${port}`);
});

// Start the bot
startBot().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
