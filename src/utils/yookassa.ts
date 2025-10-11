import { config } from '../config';

interface CreatePaymentResponse {
  id: string;
  status: string;
  confirmation: {
    type: 'redirect';
    confirmation_url: string;
  };
}

/**
 * Create payment in ЮKassa and get payment URL
 * @param telegramId - User's telegram ID to store in metadata
 * @param amount - Payment amount in rubles (e.g., 199)
 * @returns Payment URL for user to complete payment
 */
export async function createPayment(telegramId: number, amount: number): Promise<string> {
  try {
    const shopId = config.yookassa?.shopId;
    const secretKey = config.yookassa?.secretKey;

    if (!shopId || !secretKey) {
      console.error('[ЮKassa] Missing shopId or secretKey in config');
      throw new Error('ЮKassa credentials not configured');
    }

    const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

    const paymentData = {
      amount: {
        value: amount.toFixed(2),
        currency: 'RUB',
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: 'https://t.me/your_bot_name', // Замени на имя своего бота
      },
      description: 'Подписка ДаЕда на 30 дней',
      metadata: {
        telegram_id: telegramId.toString(),
      },
    };

    console.log('[ЮKassa] Creating payment for user', telegramId);

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Idempotence-Key': `${telegramId}_${Date.now()}`, // Unique key for idempotency
      },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ЮKassa] API Error:', errorText);
      throw new Error(`ЮKassa API error: ${response.status}`);
    }

    const result: CreatePaymentResponse = await response.json();

    console.log('[ЮKassa] Payment created:', result.id);

    return result.confirmation.confirmation_url;
  } catch (error) {
    console.error('[ЮKassa] Error creating payment:', error);
    throw error;
  }
}

