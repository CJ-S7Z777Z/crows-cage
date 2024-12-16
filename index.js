
// index.js

require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const Redis = require('ioredis');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Подключение к Redis
const redis = new Redis(process.env.REDIS_URL);

// Парсинг JSON запросов
app.use(express.json());

// Обслуживание статических файлов
app.use(express.static('public'));

// Инициализация Telegram бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const welcomeMessage = `Привет! Добро пожаловать в наш проект.`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Открыть мини-приложение',
            web_app: {
              url: `${process.env.APP_URL}/webapp.html?user_id=${userId}`
            }
          }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, welcomeMessage, options);
});

// Маршрут для обработки открытия WebApp
app.get('/webapp.html', async (req, res) => {
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).send('User ID is required.');
  }

  try {
    const userData = await redis.get(`user:${userId}`);

    if (userData) {
      // Пользователь уже существует, отправляем третью страницу
      res.sendFile(path.join(__dirname, 'public', 'third.html'));
    } else {
      // Новый пользователь, отправляем первую страницу
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  } catch (error) {
    console.error('Redis error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Маршрут для сохранения данных пользователя после второй страницы
app.post('/save-user-data', async (req, res) => {
  const { user_id, premium, language, account_age, bonus, total, name, username } = req.body;

  if (!user_id) {
    return res.status(400).send('User ID is required.');
  }

  try {
    // Инициализация баланса при первом сохранении
    const initialBalance = 1000; // Пример начального баланса в $crow
    const existingData = await redis.get(`user:${user_id}`);

    if (!existingData) {
      await redis.set(
        `user:${user_id}`,
        JSON.stringify({
          premium,
          language,
          account_age,
          bonus,
          total,
          balance: initialBalance,
          name: name || '',
          username: username || ''
        })
      );
    } else {
      // Обновление существующих данных
      const parsedData = JSON.parse(existingData);
      await redis.set(
        `user:${user_id}`,
        JSON.stringify({
          ...parsedData,
          premium,
          language,
          account_age,
          bonus,
          total,
        })
      );
    }

    res.status(200).send('User data saved.');
  } catch (error) {
    console.error('Redis error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Маршрут для получения данных пользователя
app.get('/user-data', async (req, res) => {
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const userData = await redis.get(`user:${userId}`);

    if (!userData) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(JSON.parse(userData));
  } catch (error) {
    console.error('Redis error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Маршрут для обновления баланса пользователя
app.post('/update-balance', async (req, res) => {
  const { user_id, amount } = req.body;

  if (!user_id || typeof amount !== 'number') {
    return res.status(400).send('Invalid request.');
  }

  try {
    const userData = await redis.get(`user:${user_id}`);

    if (!userData) {
      return res.status(404).send('User not found.');
    }

    const parsedData = JSON.parse(userData);
    parsedData.balance += amount;

    await redis.set(`user:${user_id}`, JSON.stringify(parsedData));

    res.status(200).json({ balance: parsedData.balance });
  } catch (error) {
    console.error('Redis error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Маршрут для обработки Boost запросов
app.post('/request-boost', async (req, res) => {
  const { user_id, multiplier, price } = req.body;

  if (!user_id || !multiplier || !price) {
    return res.status(400).send('Invalid request.');
  }

  try {
    const userData = await redis.get(`user:${user_id}`);
    if (!userData) {
      return res.status(404).send('User not found.');
    }

    // Проверяем наличие пользовательского чата
    const chatId = user_id; // Предполагаем, что user_id соответствует chat_id для приватных чатов

    // Формирование инвойса
    const invoice = {
      chat_id: chatId,
      title: 'Boost Purchase',
      description: `Purchase Boost x${multiplier}`,
      payload: `boost_${multiplier}`,
      provider_token: '', // Оставляем пустым, как вы указали. Обратите внимание, что Telegram требует валидный provider_token
      currency: 'XTR',
      prices: [
        { label: `${multiplier}x Boost`, amount: price * 100 }, // amount в наименьших единицах (звезды)
      ],
      start_parameter: `boost_${multiplier}`,
      photo_url: `${process.env.APP_URL}/logo.png`,
      photo_width: 100,
      photo_height: 100,
      is_flexible: false,
    };

    // Отправка инвойса через бота
    await bot.sendInvoice(invoice);

    res.status(200).send('Invoice sent.');
  } catch (error) {
    console.error('Error sending invoice:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Обработка pre_checkout_query
bot.on('pre_checkout_query', async (query) => {
  try {
    // Подтверждение инвойса
    await bot.answerPreCheckoutQuery(query.id, true);
  } catch (error) {
    console.error('Error answering pre_checkout_query:', error);
  }
});

// Обработка успешной оплаты
bot.on('successful_payment', async (msg) => {
  const user_id = msg.from.id;
  const successfulPayment = msg.successful_payment;
  const payload = successfulPayment.invoice_payload; // e.g., 'boost_2'
  const currency = successfulPayment.currency;
  const total_amount = successfulPayment.total_amount; // в наименьших единицах, например, звездным

  // Извлечение multiplier из payload
  const multiplierMatch = payload.match(/boost_(\d+)/);
  if (!multiplierMatch) {
    console.error('Invalid payload:', payload);
    return;
  }

  const multiplier = parseInt(multiplierMatch[1], 10);
  
  // Определение, сколько $crow добавить
  // Предполагается, что multiplier определяет, сколько раз увеличить текущий баланс
  // Но согласно вашим требованиям, за каждую опцию вы начисляете определённое количество
  // Например:
  const boostAmounts = {
    2: 200,  // x2 -> +200 $crow
    5: 500,  // x5 -> +500 $crow
    10: 1000, // x10 -> +1000 $crow
  };

  const boostAmount = boostAmounts[multiplier] || 0;

  if (boostAmount === 0) {
    console.error('Invalid boost multiplier:', multiplier);
    return;
  }

  try {
    const userData = await redis.get(`user:${user_id}`);
    if (!userData) {
      console.error('User data not found for user_id:', user_id);
      return;
    }

    const parsedData = JSON.parse(userData);
    parsedData.balance += boostAmount;

    await redis.set(`user:${user_id}`, JSON.stringify(parsedData));

    // Отправка уведомления пользователю через бота
    bot.sendMessage(user_id, `Boost x${multiplier} успешно приобретён! Ваш новый баланс: ${parsedData.balance} $crow`);

    console.log(`User ${user_id} boosted by x${multiplier}. New balance: ${parsedData.balance}`);
  } catch (error) {
    console.error('Error updating user balance after payment:', error);
  }
});

// Основной маршрут
app.get('/', (req, res) => {
  res.send('Сервер работает.');
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});
