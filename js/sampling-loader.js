/**
 * Загрузчик библиотек статистической выборки для расширения Chrome
 * Этот файл загружает все методы выборки из папки statistical_sampling
 * и делает их доступными через глобальный объект SamplingMethods
 */

// Инициализируем глобальный объект для методов выборки
window.SamplingMethods = window.SamplingMethods || {};

// Логирование для отладки
console.log('Загрузка модулей статистической выборки...');

// Функция для загрузки скрипта
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            console.log(`Скрипт ${src} успешно загружен`);
            resolve();
        };
        script.onerror = (error) => {
            console.error(`Ошибка загрузки скрипта ${src}:`, error);
            reject(error);
        };
        document.head.appendChild(script);
    });
}

// Загружаем все методы выборки
async function loadSamplingMethods() {
    try {
        // Путь к файлам в расширении Chrome
        // Используем путь относительно корня расширения вместо относительного пути
        const basePath = chrome.runtime.getURL('statistical_sampling/');
        console.log('Базовый путь к модулям выборки:', basePath);

        // Загружаем скрипты последовательно, чтобы гарантировать порядок
        await loadScript(basePath + 'random.js');
        await loadScript(basePath + 'systematic.js');
        await loadScript(basePath + 'stratified.js');
        await loadScript(basePath + 'mus.js');

        console.log('Все модули статистической выборки успешно загружены');

        // Проверяем, доступны ли методы выборки
        if (window.SamplingMethods &&
            window.SamplingMethods.random &&
            window.SamplingMethods.systematic &&
            window.SamplingMethods.stratified &&
            window.SamplingMethods.monetaryUnit) {
            console.log('Все методы выборки доступны в глобальном объекте SamplingMethods');
        } else {
            console.error('Не все методы выборки доступны после загрузки скриптов');
            console.log('Текущее содержимое SamplingMethods:', window.SamplingMethods);
        }

        // Вызываем событие завершения загрузки
        const event = new CustomEvent('sampling-methods-loaded');
        document.dispatchEvent(event);
    } catch (error) {
        console.error('Ошибка при загрузке модулей статистической выборки:', error);
        // Оповещаем пользователя об ошибке
        alert('Ошибка при загрузке методов выборки. Проверьте консоль для деталей.');
    }
}

// Запускаем загрузку при загрузке страницы
document.addEventListener('DOMContentLoaded', loadSamplingMethods); 