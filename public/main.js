// public/main.js
document.addEventListener('DOMContentLoaded', () => {
    // Проверка платформы (десктоп или мобильное устройство)
    const isDesktop = window.TelegramWebApp.platform === 'desktop';
    if (isDesktop) {
        document.body.innerHTML = `
            <div style="color: white; text-align: center;">
                <h1>Недоступно на компьютере</h1>
                <p>Пожалуйста, используйте мобильное устройство для открытия мини-приложения.</p>
            </div>
        `;
        return;
    }

    // Запрос на полноэкранный режим
    window.TelegramWebApp.expand();

    const startButton = document.getElementById('startButton');
    startButton.addEventListener('click', () => {
        // Переход на вторую страницу
        window.location.href = 'page2.html';
    });
});
