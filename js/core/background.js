/**
 * Фоновый скрипт расширения Statistical Sampler
 * Обрабатывает фоновые задачи расширения
 */

// Инициализация расширения при установке
chrome.runtime.onInstalled.addListener(() => {
  console.log('Statistical Sampler установлен');

  // Инициализация настроек по умолчанию
  chrome.storage.local.set({
    defaultSampleSize: 100,
    defaultSamplingMethod: 'random',
    recentFiles: []
  });
});

/**
 * Кодирует строку в base64
 * @param {string} str - Строка для кодирования
 * @returns {string} Закодированная строка в base64
 */
function encodeStringToBase64(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (error) {
    console.error('Ошибка при кодировании строки в base64:', error);
    throw new Error('Ошибка кодирования данных: ' + error.message);
  }
}

/**
 * Кодирует ArrayBuffer в base64
 * @param {ArrayBuffer|Uint8Array} buffer - ArrayBuffer или Uint8Array для кодирования
 * @returns {string} Закодированная строка в base64
 */
function encodeArrayBufferToBase64(buffer) {
  try {
    // Убедимся, что у нас Uint8Array для работы с данными
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    // Для очень больших файлов разделяем на части
    const chunkSize = 1024 * 16; // 16KB за раз
    const len = bytes.length;
    let binary = '';

    // Обрабатываем данные частями для предотвращения переполнения стека
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      // Используем более надежный метод создания строки из байтов
      const chunkArray = Array.from(chunk);
      const chunkString = String.fromCharCode.apply(null, chunkArray);
      binary += chunkString;
    }

    // Кодируем в base64
    return btoa(binary);
  } catch (error) {
    console.error('Ошибка при кодировании бинарных данных в base64:', error);
    throw new Error(`Ошибка кодирования данных Excel: ${error.message}`);
  }
}

// Обработка загрузки файлов
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadSample') {
    try {
      const { data, filename, fileType } = message;

      // Логируем детали получаемых данных
      console.log(`Обработка запроса на загрузку файла ${filename}, тип: ${fileType}`);
      console.log(`Получены данные типа: ${data instanceof Uint8Array ? 'Uint8Array' : typeof data}, размер: ${data.length || 0} байт`);

      // Конвертируем данные в base64 URL в зависимости от типа файла
      let dataUrl;

      if (fileType === 'text/csv') {
        // Для CSV (текстовый формат)
        dataUrl = `data:${fileType};base64,${encodeStringToBase64(data)}`;
      } else if (fileType.includes('spreadsheetml')) {
        // Для Excel файлов (бинарный формат)
        if (!(data instanceof Uint8Array)) {
          throw new Error('Excel данные должны быть в формате Uint8Array');
        }

        // Создаем Blob из Uint8Array
        const blob = new Blob([data], { type: fileType });

        // Создаем Object URL вместо data URL для больших файлов
        dataUrl = URL.createObjectURL(blob);

        // Отправляем на скачивание
        chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: true
        }, (downloadId) => {
          // Освобождаем URL
          URL.revokeObjectURL(dataUrl);

          if (chrome.runtime.lastError) {
            console.error('Ошибка загрузки Excel файла:', chrome.runtime.lastError);
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message
            });
          } else {
            console.log(`Excel файл ${filename} успешно отправлен на скачивание, ID: ${downloadId}`);
            sendResponse({
              success: true,
              downloadId
            });
          }
        });

        // Указываем, что ответ будет асинхронным
        return true;
      } else {
        // Для других типов файлов используем стандартный подход
        dataUrl = `data:${fileType};base64,${encodeArrayBufferToBase64(data)}`;
      }

      // Стандартная загрузка для не-Excel файлов
      chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Ошибка загрузки файла:', chrome.runtime.lastError);
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message
          });
        } else {
          console.log(`Файл ${filename} успешно отправлен на скачивание, ID: ${downloadId}`);
          sendResponse({
            success: true,
            downloadId
          });
        }
      });
    } catch (error) {
      console.error('Ошибка при обработке данных для скачивания:', error);
      sendResponse({
        success: false,
        error: error.message || 'Неизвестная ошибка'
      });
    }

    // Указываем, что ответ будет асинхронным
    return true;
  }
});

// Добавляем обработчик для открытия интерфейса в новой вкладке вместо всплывающего окна
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'popup.html' });
}); 