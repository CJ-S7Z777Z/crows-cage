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

  const welcomeMessage = `Привет! Добро пожаловать в наш проект.`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Открыть мини-приложение',
            web_app: {
              url: `${process.env.APP_URL}/webapp.html?user_id=${msg.from.id}`
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
  const { user_id, premium, language, account_age, bonus, total } = req.body;

  if (!user_id) {
    return res.status(400).send('User ID is required.');
  }

  try {
    await redis.set(
      `user:${user_id}`,
      JSON.stringify({
        premium,
        language,
        account_age,
        bonus,
        total,
      })
    );

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

// Основной маршрут
app.get('/', (req, res) => {
  res.send('Сервер работает.');
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});
