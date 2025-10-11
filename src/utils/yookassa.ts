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

    console.log('[ЮKassa] Config check:', {
      hasShopId: !!shopId,
      hasSecretKey: !!secretKey,
      shopIdValue: shopId?.substring(0, 5) + '...',
      secretKeyValue: secretKey?.substring(0, 5) + '...',
    });

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
        return_url: 'https://t.me/DaEdaFoodBot', // Замени на имя своего бота если нужно
      },
      description: 'Подписка ДаЕда на 30 дней (ТЕСТ)',
      metadata: {
        telegram_id: telegramId.toString(),
      },
    };

    console.log('[ЮKassa] Creating payment:', {
      user: telegramId,
      amount: amount,
      paymentData: JSON.stringify(paymentData)
    });

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Idempotence-Key': `${telegramId}_${Date.now()}`, // Unique key for idempotency
      },
      body: JSON.stringify(paymentData),
    });

    console.log('[ЮKassa] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ЮKassa] API Error Response:', errorText);
      console.error('[ЮKassa] Response status:', response.status);
      throw new Error(`ЮKassa API error: ${response.status} - ${errorText}`);
    }

    const result: CreatePaymentResponse = await response.json();

    console.log('[ЮKassa] Payment created successfully:', {
      id: result.id,
      status: result.status,
      url: result.confirmation.confirmation_url.substring(0, 50) + '...'
    });

    return result.confirmation.confirmation_url;
  } catch (error) {
    console.error('[ЮKassa] Error creating payment:', error);
    if (error instanceof Error) {
      console.error('[ЮKassa] Error message:', error.message);
      console.error('[ЮKassa] Error stack:', error.stack);
    }
    throw error;
  }
}

