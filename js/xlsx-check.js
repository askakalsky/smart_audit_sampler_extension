/**
 * Проверка загрузки библиотеки XLSX
 * Этот скрипт проверяет, что библиотека XLSX успешно загружена
 * и устанавливает глобальную переменную xlsxLoaded
 */

// Функция для проверки наличия библиотеки XLSX
function checkXLSXLibrary() {
    if (typeof XLSX !== 'undefined') {
        console.log('XLSX библиотека успешно загружена.');
        window.xlsxLoaded = true;

        // Отправляем событие, чтобы уведомить другие скрипты
        const event = new CustomEvent('xlsx-loaded');
        document.dispatchEvent(event);

        return true;
    } else {
        console.error('XLSX библиотека не загружена!');
        window.xlsxLoaded = false;
        return false;
    }
}

// Инициализация
window.xlsxLoaded = false;

// Проверяем сразу и через 500мс для случаев асинхронной загрузки
checkXLSXLibrary();

setTimeout(function () {
    if (!window.xlsxLoaded) {
        console.log('Повторная проверка XLSX библиотеки...');
        checkXLSXLibrary();
    }
}, 500);