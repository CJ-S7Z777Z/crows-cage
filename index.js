
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

// Получение provider_token из .env
const providerToken = process.env.PROVIDER_TOKEN;

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name || '';
  const lastName = msg.from.last_name || '';
  const username = msg.from.username || '';

  // Получение аватарки пользователя
  let avatar_url = '';
  try {
    const profilePhotos = await bot.getUserProfilePhotos(userId, 1, 0);
    if (profilePhotos.total_count > 0) {
      const fileId = profilePhotos.photos[0][profilePhotos.photos[0].length - 1].file_id;
      avatar_url = await bot.getFileLink(fileId);
    }
  } catch (error) {
    console.error('Ошибка при получении аватарки:', error);
  }

  // Проверка, существует ли пользователь в Redis
  const userData = await redis.get(`user:${userId}`);
  if (!userData) {
    // Инициализация новых данных пользователя
    const initialBalance = 1000; // Начальный баланс в $crow
    const userObject = {
      name: `${firstName} ${lastName}`.trim(),
      username: username,
      avatar_url: avatar_url || '', // Пустая строка, если аватарка не доступна
      balance: initialBalance,
      premium: false,
      language: 'ru', // По умолчанию
      account_age: 0,
      bonus: 0,
      total: 0,
    };
    await redis.set(`user:${userId}`, JSON.stringify(userObject));
  }

  // Приветственное сообщение с кнопкой открытия мини-приложения
  const welcomeMessage = `Привет, ${firstName}! Добро пожаловать в Crow Cage.`;

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
      // Пользователь существует, отправляем третью страницу
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
  const { user_id, premium, language, account_age, bonus, total } = req.body;

  if (!user_id) {
    return res.status(400).send('User ID is required.');
  }

  try {
    const existingData = await redis.get(`user:${user_id}`);

    if (!existingData) {
      return res.status(404).send('User not found.');
    }

    const parsedData = JSON.parse(existingData);
    await redis.set(
      `user:${user_id}`,
      JSON.stringify({
        ...parsedData,
        premium: premium || parsedData.premium,
        language: language || parsedData.language,
        account_age: account_age || parsedData.account_age,
        bonus: bonus || parsedData.bonus,
        total: total || parsedData.total,
      })
    );

    res.status(200).send('User data updated.');
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

  if (!providerToken) {
    return res.status(500).send('Provider token is not configured.');
  }

  try {
    const userData = await redis.get(`user:${user_id}`);
    if (!userData) {
      return res.status(404).send('User not found.');
    }

    // Формирование инвойса
    const invoice = {
      chat_id: user_id, // Предполагается, что user_id соответствует chat_id для приватных чатов
      title: 'Boost Purchase',
      description: `Purchase Boost x${multiplier}`,
      payload: `boost_${multiplier}`,
      provider_token: providerToken, // Использование provider_token из .env
      currency: 'XTR',
      prices: [
        { label: `${multiplier}x Boost`, amount: price }, // amount в наименьших единицах (звезды)
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
  const paidDetails = msg.successful_payment;

  // Извлечение multiplier из payload
  const payload = paidDetails.invoice_payload; // e.g., 'boost_2'
  const multiplierMatch = payload.match(/boost_(\d+)/);
  if (!multiplierMatch) {
    console.error('Invalid payload:', payload);
    return;
  }

  const multiplier = parseInt(multiplierMatch[1], 10);

  // Определение, сколько $crow добавить
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
    bot.sendMessage(user_id, `Boost x${multiplier} успешно приобретён! Ваш новый баланс: ${parsedData.balance} $crow ⭐`);
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
