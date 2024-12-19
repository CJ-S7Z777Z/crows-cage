// public/page2.js
document.addEventListener('DOMContentLoaded', async () => {
    window.TelegramWebApp.expand();

    const userId = window.TelegramWebApp.initDataUnsafe.user.id;
    const response = await fetch(`/api/user/${userId}`);
    const userData = await response.json();

    // Проверка, первый ли запуск
    if (!userData) {
        // Перенаправление на главную страницу
        window.location.href = 'index.html';
        return;
    }

    // Анимация подсчета
    const animateCount = (id, target, duration) => {
        let start = 0;
        const increment = target / (duration / 50);
        const element = document.getElementById(id);
        const interval = setInterval(() => {
            start += increment;
            if (start >= target) {
                start = target;
                clearInterval(interval);
            }
            element.textContent = Math.floor(start);
        }, 50);
    };

    // Получение параметров
    const premium = userData.premium ? 250 : 0;
    const language = userData.language === 'en' ? 75 : userData.language === 'ru' ? 85 : 0;
    const accountAge = Math.floor(Math.random() * 56) + 45; // от 45 до 100
    const bonus = Math.floor(Math.random() * 101) + 75; // от 75 до 175
    const total = premium + language + accountAge + bonus;

    // Анимируем подсчет
    animateCount('premium', premium, 1000);
    animateCount('language', language, 1000);
    animateCount('accountAge', accountAge, 1000);
    animateCount('bonus', bonus, 1000);
    setTimeout(() => {
        document.getElementById('total').textContent = `${total} $crow`;
        // Обновление баланса в Redis (можно настроить по необходимости)
        fetch(`/api/user/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balance: total })
        });
    }, 1000);

    // Обработка кнопки THEN
    const thenButton = document.getElementById('thenButton');
    thenButton.addEventListener('click', () => {
        window.location.href = 'page3.html';
    });
});
