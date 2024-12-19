// public/page3.js
document.addEventListener('DOMContentLoaded', async () => {
    window.TelegramWebApp.expand();

    const userId = window.TelegramWebApp.initDataUnsafe.user.id;
    const response = await fetch(`/api/user/${userId}`);
    const userData = await response.json();

    // Проверка, прошел ли пользователь подсчет
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }

    // Отображение баланса
    const balanceElement = document.getElementById('balance');
    balanceElement.textContent = userData.balance || 0;

    // Обработка кнопки Boost
    const boostButton = document.getElementById('boostButton');
    const popup = document.getElementById('popup');
    const closeBtn = document.querySelector('.close-btn');

    boostButton.addEventListener('click', () => {
        popup.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', () => {
        popup.classList.add('hidden');
    });

    // Обработка опций попапа
    const options = document.querySelectorAll('.popup-option');
    options.forEach(option => {
        option.addEventListener('click', () => {
            const multiplier = option.getAttribute('data-multiplier');
            // Здесь должна быть реализация транзакции
            // Пример: обновление баланса

            // Имитация транзакции
            setTimeout(() => {
                const newBalance = userData.balance * multiplier;
                balanceElement.textContent = newBalance;
                // Обновление на сервере
                fetch(`/api/user/${userId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ balance: newBalance })
                });
                popup.classList.add('hidden');
            }, 1000);
        });
    });

    // Добавление информации о пользователе (например, аватар и имя)
    const userInfo = document.querySelector('.username');
    const userIdSpan = document.querySelector('.userid');
    userInfo.textContent = window.TelegramWebApp.initDataUnsafe.user.first_name;
    userIdSpan.textContent = `@${window.TelegramWebApp.initDataUnsafe.user.username || 'user'}`;
});
