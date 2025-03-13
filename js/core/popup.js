/**
 * Проверка загрузки XLSX и обработка случая, если она не загружена
 */
function checkXLSXLoaded() {
  if (typeof XLSX === 'undefined') {
    console.error('Библиотека XLSX не загружена в popup.js');

    // Добавляем обработчик, который будет повторно проверять наличие библиотеки
    const checkInterval = setInterval(() => {
      if (typeof XLSX !== 'undefined') {
        console.log('XLSX библиотека загружена после повторной проверки');
        clearInterval(checkInterval);
        // Если библиотека загрузилась позже, активируем кнопку Excel
        if (window.data && window.data.filter(item => item.is_sample).length > 0) {
          const exportExcelBtn = document.getElementById('exportExcelBtn');
          if (exportExcelBtn) {
            exportExcelBtn.disabled = false;
            exportExcelBtn.classList.add('btn-active');
          }
        }
      }
    }, 1000);

    return false;
  }

  console.log('XLSX библиотека успешно загружена в popup.js');
  return true;
}

/**
 * Statistical Sampler - JavaScript для popup-окна
 * Обрабатывает взаимодействие с пользователем и управляет процессом выборки
 */

// Глобальные переменные для данных
window.data = null;              // Все данные (популяция)
let columns = [];             // Колонки данных
let sampleData = null;        // Данные выборки
let samplingMethodsLoaded = false;
let selectedExportType = 'sample'; // Тип экспорта (sample - только выборка, all - вся популяция)
let xlsxLoaded = false;       // Флаг загрузки XLSX библиотеки

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function () {
  // Проверяем загрузку XLSX
  xlsxLoaded = checkXLSXLoaded();

  // Элементы DOM
  const fileInput = document.getElementById('fileInput');
  const fileName = document.getElementById('fileName');
  const sampleMethod = document.getElementById('sampleMethod');
  const sampleSize = document.getElementById('sampleSize');
  const stratifiedOptions = document.getElementById('stratifiedOptions');
  const stratifyColumn = document.getElementById('stratifyColumn');
  const monetaryUnitOptions = document.getElementById('monetaryUnitOptions');
  const valueColumn = document.getElementById('valueColumn');
  const ignoreZero = document.getElementById('ignoreZero');
  const generateSample = document.getElementById('generateSample');
  const resultsContainer = document.getElementById('resultsContainer');
  const populationSize = document.getElementById('populationSize');
  const actualSampleSize = document.getElementById('actualSampleSize');
  const tableHeader = document.getElementById('tableHeader');
  const tableBody = document.getElementById('tableBody');
  const sampleMethodSelect = document.getElementById('sampleMethodSelect');
  const generateSampleBtn = document.getElementById('generateSampleBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportExcelBtn = document.getElementById('exportExcelBtn');

  // Обработчики событий
  fileInput.addEventListener('change', handleFileUpload);
  sampleMethodSelect.addEventListener('change', toggleMethodOptions);
  generateSampleBtn.addEventListener('click', generateSampleData);

  // Обработчики для кнопок экспорта - переопределяем здесь напрямую
  document.getElementById('exportCsvBtn').addEventListener('click', function () {
    try {
      // Получаем данные для экспорта
      let dataToExport;

      if (window.dataManager) {
        // Используем dataManager для получения данных
        dataToExport = window.dataManager.getOriginalData();
      } else {
        // Для обратной совместимости
        dataToExport = window.data;
      }

      // Проверяем наличие данных
      if (!dataToExport || !Array.isArray(dataToExport) || dataToExport.length === 0) {
        console.error('Глобальные данные не найдены!');
        showMessage('Нет данных для экспорта. Пожалуйста, загрузите файл и создайте выборку.', 'error');
        return;
      }

      // Проверяем наличие выборки
      if (!dataToExport.some(item => item.is_sample === true)) {
        console.error('В данных нет отмеченных элементов выборки!');
        showMessage('Нет данных выборки для экспорта. Пожалуйста, сформируйте выборку.', 'error');
        return;
      }

      // Определяем, что экспортировать - только выборку или полные данные
      const exportType = document.querySelector('input[name="exportType"]:checked').value;

      // Готовим данные для экспорта
      let dataForExport = JSON.parse(JSON.stringify(dataToExport));

      // Фильтруем данные, если нужно экспортировать только выборку
      if (exportType === 'sample') {
        dataForExport = dataForExport.filter(item => item.is_sample === true);
      }

      // Экспортируем данные
      exportDataFile(dataForExport, 'csv');
    } catch (error) {
      console.error('Ошибка при экспорте в CSV:', error);
      showMessage('Ошибка при экспорте: ' + error.message, 'error');
    }
  });

  document.getElementById('exportExcelBtn').addEventListener('click', function () {
    try {
      // Получаем данные для экспорта
      let dataToExport;

      if (window.dataManager) {
        // Используем dataManager для получения данных
        dataToExport = window.dataManager.getOriginalData();
      } else {
        // Для обратной совместимости
        dataToExport = window.data;
      }

      // Проверяем наличие данных
      if (!dataToExport || !Array.isArray(dataToExport) || dataToExport.length === 0) {
        console.error('Глобальные данные не найдены!');
        showMessage('Нет данных для экспорта. Пожалуйста, загрузите файл и создайте выборку.', 'error');
        return;
      }

      // Проверяем наличие выборки
      if (!dataToExport.some(item => item.is_sample === true)) {
        console.error('В данных нет отмеченных элементов выборки!');
        showMessage('Нет данных выборки для экспорта. Пожалуйста, сформируйте выборку.', 'error');
        return;
      }

      // Проверяем наличие библиотеки XLSX
      if (typeof XLSX === 'undefined') {
        console.error('Библиотека XLSX не загружена');
        showMessage('Библиотека XLSX не загружена. Проверьте подключение скрипта.', 'error');
        return;
      }

      // Определяем, что экспортировать - только выборку или полные данные
      const exportType = document.querySelector('input[name="exportType"]:checked').value;

      // Готовим данные для экспорта
      let dataForExport = JSON.parse(JSON.stringify(dataToExport));

      // Фильтруем данные, если нужно экспортировать только выборку
      if (exportType === 'sample') {
        dataForExport = dataForExport.filter(item => item.is_sample === true);
      }

      // Экспортируем данные
      exportDataFile(dataForExport, 'xlsx');
    } catch (error) {
      console.error('Ошибка при экспорте в Excel:', error);
      showMessage('Ошибка при экспорте: ' + error.message, 'error');
    }
  });

  // Обработчики для радиокнопок типа экспорта
  document.querySelectorAll('input[name="exportType"]').forEach(radio => {
    radio.addEventListener('change', function () {
      selectedExportType = this.value;
      console.log(`Выбран тип экспорта: ${selectedExportType}`);

      // Если есть результаты выборки, обновляем отображение
      if (window.data && window.data.filter(item => item.is_sample).length > 0) {
        displayResults();
      }
    });
  });

  // Загрузка настроек из хранилища
  chrome.storage.local.get(['defaultSampleSize', 'defaultSamplingMethod'], function (result) {
    // Устанавливаем размер выборки по умолчанию
    if (result.defaultSampleSize) {
      document.getElementById('randomSampleSize').value = result.defaultSampleSize;
      document.getElementById('systematicSampleSize').value = result.defaultSampleSize;
      document.getElementById('stratifiedSampleSize').value = result.defaultSampleSize;
      document.getElementById('musSampleSize').value = result.defaultSampleSize;
    }

    // Устанавливаем метод выборки по умолчанию
    if (result.defaultSamplingMethod &&
      sampleMethodSelect.querySelector(`option[value="${result.defaultSamplingMethod}"]`)) {
      sampleMethodSelect.value = result.defaultSamplingMethod;
      toggleMethodOptions();
    }
  });

  // Обработчик события загрузки методов выборки
  document.addEventListener('sampling-methods-loaded', function () {
    console.log('Методы выборки загружены и готовы к использованию');
    samplingMethodsLoaded = true;

    // Если данные уже загружены, активируем кнопку
    if (window.data && window.data.length > 0) {
      generateSampleBtn.disabled = false;
    }
  });

  // Устанавливаем флаг samplingMethodsLoaded в true также напрямую,
  // чтобы кнопка могла работать даже если событие не сработает
  setTimeout(function () {
    if (!samplingMethodsLoaded) {
      console.log('Принудительная активация методов выборки');
      samplingMethodsLoaded = true;

      // Если данные уже загружены, активируем кнопку
      if (window.data && window.data.length > 0) {
        generateSampleBtn.disabled = false;
      }
    }
  }, 3000); // Ждем 3 секунды, затем активируем флаг

  // Инициализация интерфейса
  toggleMethodOptions();

  // Вызываем диагностику через 3 секунды после загрузки страницы
  setTimeout(diagnoseDataState, 3000);

  // Принудительно активируем глобальную переменную, если её не существует
  if (typeof window.data === 'undefined') {
    console.warn('Инициализация window.data, так как она не определена');
    window.data = [];
  }

  // Проверяем dataManager и добавляем недостающие методы
  ensureDataManager();

  // Добавляем обработчик на кнопку генерации выборки для дополнительного контроля
  if (generateSampleBtn) {
    generateSampleBtn.addEventListener('click', function () {
      // Регистрируем время нажатия для последующей диагностики
      console.log('Кнопка генерации выборки нажата в:', new Date().toISOString());

      // Запускаем диагностику через 2 секунды после нажатия
      setTimeout(function () {
        console.log('Состояние данных через 2 секунды после генерации выборки:');
        diagnoseDataState();
      }, 2000);
    });
  }

  // Обработка видимости поля threshold для MUS
  const musIgnoreZeroValues = document.getElementById('musIgnoreZeroValues');
  const musThresholdContainer = document.getElementById('musThreshold').closest('.input-group');

  // Функция обновления видимости поля threshold
  function updateMusThresholdVisibility() {
    if (musIgnoreZeroValues.checked) {
      musThresholdContainer.style.display = 'none';
    } else {
      musThresholdContainer.style.display = '';
    }
  }

  // Инициализация при загрузке страницы
  updateMusThresholdVisibility();

  // Обработчик события изменения переключателя
  musIgnoreZeroValues.addEventListener('change', updateMusThresholdVisibility);

  // Инициализация обработчика для чекбокса автоматического порога
  const useAutoThresholdCheckbox = document.getElementById('useAutoThreshold');
  if (useAutoThresholdCheckbox) {
    useAutoThresholdCheckbox.addEventListener('change', toggleThresholdField);
  }

  // Инициализация обработчиков для Isolation Forest
  const useTopNMode = document.getElementById('useTopNMode');
  if (useTopNMode) {
    useTopNMode.addEventListener('change', toggleSamplingMode);
  }
});

/**
 * Обрабатывает загрузку файла
 */
function handleFileUpload(event) {
  const fileInput = event.target;
  const files = fileInput.files;

  if (files.length === 0) return;

  const file = files[0];
  if (!file) return;

  // Сохраняем информацию о файле глобально, чтобы использовать её после формирования выборки
  window.selectedFileInfo = {
    name: file.name,
    size: file.size,
    records: 0,  // Инициализируем 0, позже можно обновить при разборе файла
    columns: 0
  };

  // Показываем индикатор загрузки
  const dataInfo = document.getElementById('dataInfo');
  dataInfo.innerHTML = `
    <div class="alert alert-info">
      <div class="d-flex align-items-center">
        <span class="loading-spinner"></span>
        <span class="material-icons ms-2 me-2">cloud_upload</span>
        <div>Загрузка файла: ${file.name} (${formatFileSize(file.size)})...</div>
      </div>
    </div>
  `;

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const extension = file.name.split('.').pop().toLowerCase();
      let parsedData;

      if (extension === 'csv') {
        parsedData = parseCSV(e.target.result);
      } else if (['xlsx', 'xls'].includes(extension)) {
        parsedData = parseExcel(e.target.result);
      } else {
        throw new Error('Неподдерживаемый формат файла');
      }

      // Добавляем уникальный идентификатор для каждой записи
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        parsedData.forEach((item, index) => {
          item._record_id = index;
        });
      }

      // Сохраняем данные в dataManager
      if (window.dataManager) {
        window.dataManager.setOriginalData(parsedData);
      } else {
        // Для обратной совместимости
        window.data = parsedData;
      }

      // Обновляем селекторы колонок
      updateColumnSelectors();

      // Активируем кнопку генерации выборки
      const generateSampleBtn = document.getElementById('generateSampleBtn');
      if (generateSampleBtn) {
        generateSampleBtn.disabled = false;
      }

      // Обновляем информацию о загруженных данных
      updateDataInfo({
        name: file.name,
        size: file.size,
        records: parsedData.length,
        columns: parsedData.length > 0 ? Object.keys(parsedData[0]).length : 0
      });

      // Показываем сообщение об успешной загрузке
      showMessage(`Файл успешно загружен. Записей: ${parsedData.length}`, 'success');
    } catch (error) {
      console.error('Ошибка при обработке файла:', error);
      showError(`Ошибка при обработке файла: ${error.message}`);

      // Очищаем данные в случае ошибки
      if (window.dataManager) {
        window.dataManager.clearAllData();
      } else {
        window.data = [];
      }

      showLoader(dataInfo, false);
    }
  };

  reader.onerror = function () {
    showError('Ошибка чтения файла');
    showLoader(dataInfo, false);
  };

  if (['xlsx', 'xls'].includes(file.name.split('.').pop().toLowerCase())) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }
}

/**
 * Форматирует размер файла для отображения
 * @param {number} bytes - Размер в байтах
 * @returns {string} Отформатированный размер
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Байт';

  const sizes = ['Байт', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Парсит CSV-файл
 */
function parseCSV(text) {
  // Простой парсер CSV (для более сложных случаев лучше использовать библиотеку)
  const lines = text.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const result = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = lines[i].split(',').map(v => v.trim());
    const obj = {};

    headers.forEach((header, index) => {
      // Пытаемся преобразовать в число, если это возможно
      const value = values[index];
      obj[header] = isNaN(value) ? value : Number(value);
    });

    result.push(obj);
  }

  return result;
}

/**
 * Парсит Excel-файл
 */
function parseExcel(buffer) {
  try {
    // Используем библиотеку SheetJS
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Преобразуем лист в JSON
    return XLSX.utils.sheet_to_json(sheet);
  } catch (e) {
    console.error('Ошибка при парсинге Excel-файла:', e);
    throw new Error('Не удалось прочитать Excel-файл. Убедитесь, что файл не поврежден.');
  }
}

/**
 * Обновляет селекторы колонок для стратифицированной и монетарной выборки
 */
function updateColumnSelectors() {
  // Получаем данные из dataManager или используем глобальные данные для обратной совместимости
  const data = window.dataManager ? window.dataManager.getOriginalData() : window.data;

  if (!data || data.length === 0) {
    console.warn('Нет данных для обновления селекторов колонок');
    return;
  }

  // Определяем колонки из первой строки данных
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  // Фильтруем колонки, исключая служебные поля
  const filteredColumns = columns.filter(column => column !== '_record_id');

  // Обновляем селектор колонок для стратифицированной выборки
  const stratifiedSelect = document.getElementById('stratifiedColumn');
  if (!stratifiedSelect) {
    console.warn('Не найден элемент stratifiedColumn');
    return;
  }

  stratifiedSelect.innerHTML = '';

  // Добавляем элемент "Выберите колонку"
  const stratDefaultOption = document.createElement('option');
  stratDefaultOption.value = '';
  stratDefaultOption.text = 'Выберите колонку для стратификации';
  stratDefaultOption.disabled = true;
  stratDefaultOption.selected = true;
  stratifiedSelect.appendChild(stratDefaultOption);

  // Добавляем опции из колонок данных
  filteredColumns.forEach(column => {
    // Создаем новую опцию для стратификации
    const option = document.createElement('option');
    option.value = column;
    option.textContent = column;

    // Добавляем все колонки без ограничений
    stratifiedSelect.appendChild(option);
  });

  // Обновляем селектор колонок для монетарной выборки
  const musSelect = document.getElementById('musValueColumn');
  if (!musSelect) {
    console.warn('Не найден элемент musValueColumn');
    return;
  }

  musSelect.innerHTML = '';

  // Добавляем элемент "Выберите колонку"
  const musDefaultOption = document.createElement('option');
  musDefaultOption.value = '';
  musDefaultOption.text = 'Выберите колонку со значениями';
  musDefaultOption.disabled = true;
  musDefaultOption.selected = true;
  musSelect.appendChild(musDefaultOption);

  // Добавляем опции только для числовых колонок
  filteredColumns.forEach(column => {
    // Проверяем, содержит ли колонка числовые данные
    const isNumeric = data.every(row => {
      const value = row[column];
      return !isNaN(parseFloat(value)) && isFinite(value);
    });

    if (isNumeric) {
      const option = document.createElement('option');
      option.value = column;
      option.textContent = column;
      musSelect.appendChild(option);
    }
  });

  // Обновляем селектор колонок для стратификации в MUS
  const musStrataSelect = document.getElementById('musStrataColumn');
  if (musStrataSelect) {
    musStrataSelect.innerHTML = '';

    // Добавляем пустую опцию (без стратификации)
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.text = 'Без стратификации';
    emptyOption.selected = true;
    musStrataSelect.appendChild(emptyOption);

    // Добавляем опции из колонок данных
    filteredColumns.forEach(column => {
      const option = document.createElement('option');
      option.value = column;
      option.textContent = column;
      musStrataSelect.appendChild(option);
    });
  } else {
    console.warn('Не найден элемент musStrataColumn');
  }

  // Добавим визуальные подсказки, если нет подходящих колонок
  if (stratifiedSelect.options.length <= 1) {
    const option = document.createElement('option');
    option.textContent = 'Нет подходящих колонок для стратификации';
    option.disabled = true;
    stratifiedSelect.appendChild(option);
  }

  if (musSelect.options.length <= 1) {
    const option = document.createElement('option');
    option.textContent = 'Нет числовых колонок для MUS';
    option.disabled = true;
    musSelect.appendChild(option);
  }

  console.log('Обновлены селекторы колонок:', {
    stratColumns: stratifiedSelect.options.length - 1,
    musColumns: musSelect.options.length - 1
  });
}

/**
 * Переключает отображение параметров в зависимости от выбранного метода выборки
 */
function toggleMethodOptions() {
  const selectedMethod = document.getElementById('sampleMethodSelect').value;
  console.log('Выбран метод:', selectedMethod);

  // Скрываем все панели с опциями
  document.querySelectorAll('.method-options').forEach(element => {
    element.style.display = 'none';
  });

  // Управляем видимостью вкладки "Подробности" в зависимости от метода
  // Показываем вкладку только для методов машинного обучения
  const isMLMethod = selectedMethod === 'isolationForest';
  toggleDetailsTab(isMLMethod);

  // Показываем только опции для выбранного метода
  switch (selectedMethod) {
    case 'random':
      document.getElementById('randomOptions').style.display = 'block';
      break;
    case 'systematic':
      document.getElementById('systematicOptions').style.display = 'block';
      break;
    case 'stratified':
      document.getElementById('stratifiedOptions').style.display = 'block';
      // Обновляем селектор колонок для стратификации
      updateColumnSelector('stratifyColumn', true);
      break;
    case 'mus':
      document.getElementById('musOptions').style.display = 'block';
      // Обновляем селектор колонок для значений
      updateColumnSelector('valueColumn', false);
      break;
    case 'isolationForest':
      document.getElementById('isolationForestOptions').style.display = 'block';
      // Обновляем списки признаков
      updateFeatureSelectors();
      // Инициализируем состояние поля порога аномалии
      toggleThresholdField();
      // Обновляем списки признаков
      updateFeatureSelectors();
      // Инициализируем UI для Isolation Forest
      setupIsolationForestUI();
      break;
  }
}

/**
 * Управляет видимостью вкладки "Подробности"
 * @param {boolean} show - показать/скрыть вкладку
 */
function toggleDetailsTab(show) {
  const detailsTabContainer = document.getElementById('details-tab-container');
  if (detailsTabContainer) {
    detailsTabContainer.style.display = show ? 'block' : 'none';
  }

  // Если вкладка была активна, но теперь её нужно скрыть, переключаемся на "Настройки"
  if (!show) {
    const detailsTab = document.getElementById('details-tab');
    if (detailsTab && detailsTab.classList.contains('active')) {
      document.getElementById('settings-tab').click();
    }
  }
}

/**
 * Обновляет интерфейс с матрицей выбора признаков для анализа
 * Отображает все доступные признаки с возможностью выбора их типа
 */
function updateFeatureSelectors() {
  // Получаем данные
  const data = window.dataManager ? window.dataManager.getOriginalData() : window.data;
  if (!data || data.length === 0) return;

  // Получаем контейнер для таблицы признаков
  const featuresTableBody = document.getElementById('featuresTableBody');
  if (!featuresTableBody) return;

  // Очищаем таблицу
  featuresTableBody.innerHTML = '';

  try {
    // Определяем типы колонок, используя функцию из модуля препроцессинга
    let columnTypes = { numerical: [], categorical: [] };

    // Используем функцию из модуля препроцессинга, если она доступна
    if (typeof window.detectColumnTypes === 'function') {
      columnTypes = window.detectColumnTypes(data, {
        threshold: 0.8,
        maxUniqueValues: 20
      });
    } else {
      // Упрощенное определение типов для случая, когда модуль препроцессинга недоступен
      const firstItem = data[0];

      Object.keys(firstItem).forEach(key => {
        if (typeof firstItem[key] === 'number') {
          columnTypes.numerical.push(key);
        } else {
          columnTypes.categorical.push(key);
        }
      });

      console.warn('Модуль препроцессинга недоступен, используется упрощенное определение типов');
    }

    console.log('Определены типы колонок:', columnTypes);

    // Получаем все колонки без дубликатов и системных полей
    const ignoreFields = ['is_sample', 'anomaly_score', '_record_id']; // Добавляем _record_id в список игнорируемых полей
    const allFeatures = Array.from(new Set([
      ...columnTypes.numerical,
      ...columnTypes.categorical
    ])).filter(column => !ignoreFields.includes(column));

    if (allFeatures.length === 0) {
      featuresTableBody.innerHTML = `
        <tr>
          <td colspan="3" class="text-center text-muted">
            Не найдены подходящие признаки для анализа
          </td>
        </tr>
      `;
      return;
    }

    // Добавляем строки для каждого признака
    allFeatures.forEach(feature => {
      const isNumerical = columnTypes.numerical.includes(feature);
      const isCategorical = columnTypes.categorical.includes(feature);

      const row = document.createElement('tr');
      row.className = 'feature-row';
      row.dataset.feature = feature;

      row.innerHTML = `
        <td>${feature}</td>
        <td>
          <div class="form-check">
            <input class="form-check-input numericalFeature" type="checkbox" 
              id="numerical_${feature}" value="${feature}" 
              ${isNumerical ? 'checked' : ''}>
          </div>
        </td>
        <td>
          <div class="form-check">
            <input class="form-check-input categoricalFeature" type="checkbox" 
              id="categorical_${feature}" value="${feature}" 
              ${isCategorical ? 'checked' : ''}>
          </div>
        </td>
      `;

      featuresTableBody.appendChild(row);
    });

    // Добавляем обработчики событий для кнопок выбора
    setupFeatureSelectionButtons();

    // Добавляем обработчик для фильтрации признаков
    setupFeatureFilter();

  } catch (error) {
    console.error('Ошибка при обновлении селекторов признаков:', error);
    featuresTableBody.innerHTML = `
      <tr>
        <td colspan="3" class="text-danger">
          Ошибка при определении признаков: ${error.message}
        </td>
      </tr>
    `;
  }
}

/**
 * Настраивает кнопки для быстрого выбора признаков
 */
function setupFeatureSelectionButtons() {
  // Кнопка выбора всех числовых признаков
  const selectAllNumericalBtn = document.getElementById('selectAllNumerical');
  if (selectAllNumericalBtn) {
    selectAllNumericalBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.numericalFeature');
      checkboxes.forEach(checkbox => checkbox.checked = true);
    });
  }

  // Кнопка выбора всех категориальных признаков
  const selectAllCategoricalBtn = document.getElementById('selectAllCategorical');
  if (selectAllCategoricalBtn) {
    selectAllCategoricalBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.categoricalFeature');
      checkboxes.forEach(checkbox => checkbox.checked = true);
    });
  }

  // Кнопка сброса выбора
  const resetSelectionBtn = document.getElementById('resetFeatureSelection');
  if (resetSelectionBtn) {
    resetSelectionBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.numericalFeature, .categoricalFeature');
      checkboxes.forEach(checkbox => checkbox.checked = false);
    });
  }
}

/**
 * Настраивает фильтр для быстрого поиска признаков
 */
function setupFeatureFilter() {
  const filterInput = document.getElementById('featureFilter');
  if (!filterInput) return;

  filterInput.addEventListener('input', function () {
    const filterText = this.value.toLowerCase().trim();
    const featureRows = document.querySelectorAll('.feature-row');

    featureRows.forEach(row => {
      const featureName = row.dataset.feature.toLowerCase();
      if (featureName.includes(filterText)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });
}

/**
 * Получает выбранные признаки из матрицы выбора
 * 
 * @param {string} type - Тип признаков ('numerical' или 'categorical')
 * @returns {Array<string>} Массив имен выбранных признаков
 */
function getSelectedFeatures(type) {
  const selector = type === 'numerical' ? '.numericalFeature:checked' : '.categoricalFeature:checked';
  const checkboxes = document.querySelectorAll(selector);
  return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Переключает видимость поля ввода порога аномалии в зависимости от состояния чекбокса
 */
function toggleThresholdField() {
  const useAutoThreshold = document.getElementById('useAutoThreshold');
  const thresholdField = document.getElementById('anomalyThreshold');
  const thresholdFieldLabel = document.querySelector('label[for="anomalyThreshold"]');

  if (useAutoThreshold && thresholdField) {
    thresholdField.disabled = useAutoThreshold.checked;

    if (thresholdFieldLabel) {
      thresholdFieldLabel.textContent = useAutoThreshold.checked ?
        'Пороговое значение (определяется автоматически)' :
        'Пороговое значение аномалии (0-1)';
    }
  }
}

/**
 * Отображает загрузку в указанном элементе
 * @param {HTMLElement} element - Элемент, в котором отображается загрузка
 * @param {boolean} isLoading - Состояние загрузки
 */
function showLoading(element, isLoading) {
  if (!element) {
    console.error('showLoading: элемент не передан');
    return;
  }

  try {
    if (isLoading) {
      // Проверяем, нет ли уже индикатора загрузки
      if (!element.querySelector('.loading-spinner')) {
        // Сохраняем оригинальный текст кнопки в атрибуте
        const originalText = element.innerHTML.trim();
        element.setAttribute('data-original-text', originalText);

        // Добавляем индикатор загрузки с Material Design стилем
        element.innerHTML = `
          <span class="loading-spinner"></span>
          <span>${originalText}</span>
        `;
      }
      element.disabled = true;
    } else {
      // Восстанавливаем оригинальный текст из атрибута
      const originalText = element.getAttribute('data-original-text');
      if (originalText) {
        element.innerHTML = originalText;
      } else {
        // Если нет сохраненного текста, просто удаляем индикатор
        const loadingSpinner = element.querySelector('.loading-spinner');
        if (loadingSpinner) {
          loadingSpinner.remove();
        }
      }
      element.disabled = false;
    }
  } catch (error) {
    console.error('Ошибка при отображении загрузки:', error);
    // Предотвращаем возможное бесконечное отключение кнопки
    if (element) {
      element.disabled = false;
    }
  }
}

/**
 * Добавляем отладочную функцию
 */
function debugButtons() {
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportExcelBtn = document.getElementById('exportExcelBtn');

  console.log('==== ОТЛАДКА КНОПОК ЭКСПОРТА ====');

  if (exportCsvBtn) {
    console.log('Кнопка CSV найдена:');
    console.log('- disabled: ' + exportCsvBtn.disabled);
    console.log('- classList: ' + Array.from(exportCsvBtn.classList).join(', '));
    console.log('- стиль: ' + exportCsvBtn.getAttribute('style'));
    console.log('- родитель: ' + (exportCsvBtn.parentElement ? exportCsvBtn.parentElement.tagName : 'нет'));

    // Принудительно удаляем атрибут disabled
    exportCsvBtn.removeAttribute('disabled');
    console.log('Атрибут disabled удален для CSV');
  } else {
    console.log('Кнопка CSV не найдена в DOM!');
  }

  if (exportExcelBtn) {
    console.log('Кнопка Excel найдена:');
    console.log('- disabled: ' + exportExcelBtn.disabled);
    console.log('- classList: ' + Array.from(exportExcelBtn.classList).join(', '));
    console.log('- стиль: ' + exportExcelBtn.getAttribute('style'));
    console.log('- родитель: ' + (exportExcelBtn.parentElement ? exportExcelBtn.parentElement.tagName : 'нет'));

    // Принудительно удаляем атрибут disabled
    exportExcelBtn.removeAttribute('disabled');
    console.log('Атрибут disabled удален для Excel');
  } else {
    console.log('Кнопка Excel не найдена в DOM!');
  }

  // Принудительно включаем кнопки через небольшую задержку
  setTimeout(function () {
    if (exportCsvBtn) {
      exportCsvBtn.disabled = false;
      exportCsvBtn.classList.add('btn-active');
      exportCsvBtn.style.opacity = '1';
      exportCsvBtn.style.cursor = 'pointer';
      exportCsvBtn.style.backgroundColor = '#34A853';
      console.log('Кнопка CSV принудительно активирована через стили');
    }

    if (exportExcelBtn) {
      exportExcelBtn.disabled = false;
      exportExcelBtn.classList.add('btn-active');
      exportExcelBtn.style.opacity = '1';
      exportExcelBtn.style.cursor = 'pointer';
      exportExcelBtn.style.backgroundColor = '#34A853';
      console.log('Кнопка Excel принудительно активирована через стили');
    }
  }, 500);
}

/**
 * Генерирует выборку из данных
 */
function generateSampleData() {
  try {
    // Сначала проверяем наличие необходимых методов в dataManager
    ensureDataManager();

    // Получаем данные из dataManager
    const originalData = window.dataManager ? window.dataManager.getOriginalData() : window.data;

    // Проверяем наличие данных
    if (!originalData || !Array.isArray(originalData) || originalData.length === 0) {
      showError('Нет данных для формирования выборки');
      return;
    }

    // Получаем выбранный метод
    const selectedMethod = document.getElementById('sampleMethodSelect').value;

    // Создаем глубокую копию данных для безопасного изменения
    let dataCopy = JSON.parse(JSON.stringify(originalData));

    // Удаляем предыдущие метки выборки
    dataCopy = dataCopy.map(item => {
      const copy = { ...item };
      delete copy.is_sample;
      // Также удаляем anomaly_score, который мог остаться от предыдущего запуска Isolation Forest
      if (copy.anomaly_score !== undefined) {
        delete copy.anomaly_score;
      }
      return copy;
    });

    // Показываем индикатор загрузки
    const generateBtn = document.getElementById('generateSampleBtn');
    showLoading(generateBtn, true);

    // Настройки выборки
    const sampleResult = {
      data: [],
      method: selectedMethod,
      parameters: {},
      result: {}
    };

    // Применяем соответствующий метод выборки
    switch (selectedMethod) {
      case 'random':
        const randomSize = parseInt(document.getElementById('randomSampleSize').value, 10);
        const randomSeed = parseInt(document.getElementById('randomSeed').value, 10);

        sampleResult.parameters = {
          size: randomSize,
          seed: randomSeed
        };

        try {
          // Получаем результат выборки
          const randomSampleResult = window.SamplingMethods.random.sample(dataCopy, randomSize, {
            seed: randomSeed || undefined
          });

          // Проверяем, что результат содержит population с отмеченными элементами
          if (randomSampleResult && randomSampleResult.population) {
            // Нормализуем значения is_sample для единообразия (всегда boolean)
            const normalizedPopulation = randomSampleResult.population.map(item => ({
              ...item,
              is_sample: item.is_sample === 1 || item.is_sample === true
            }));

            sampleResult.data = normalizedPopulation;
            console.log('Случайная выборка успешно создана:', randomSampleResult);
          } else {
            throw new Error('Некорректный результат случайной выборки');
          }
        } catch (e) {
          console.error('Ошибка при создании случайной выборки:', e);
          // Используем запасной метод
          const backupResult = generateSimpleSample(dataCopy, {
            method: selectedMethod,
            size: randomSize,
            seed: randomSeed
          });
          sampleResult.data = backupResult.data;
        }
        break;

      case 'systematic':
        const systematicSize = parseInt(document.getElementById('systematicSampleSize').value, 10);
        const systematicStartPoint = parseInt(document.getElementById('systematicStartPoint').value, 10);

        sampleResult.parameters = {
          size: systematicSize,
          startPoint: systematicStartPoint
        };

        try {
          // Получаем результат выборки
          const systematicSampleResult = window.SamplingMethods.systematic.sample(dataCopy, {
            sampleSize: systematicSize,
            startPoint: systematicStartPoint
          });

          // Проверяем, что результат содержит population с отмеченными элементами
          if (systematicSampleResult && systematicSampleResult.population) {
            // Нормализуем значения is_sample для единообразия (всегда boolean)
            const normalizedPopulation = systematicSampleResult.population.map(item => ({
              ...item,
              is_sample: item.is_sample === 1 || item.is_sample === true
            }));

            sampleResult.data = normalizedPopulation;
            console.log('Систематическая выборка успешно создана:', systematicSampleResult);
          } else {
            throw new Error('Некорректный результат систематической выборки');
          }
        } catch (e) {
          console.error('Ошибка при создании систематической выборки:', e);
          // Используем запасной метод
          const backupResult = generateSimpleSample(dataCopy, {
            method: selectedMethod,
            size: systematicSize
          });
          sampleResult.data = backupResult.data;
        }
        break;

      case 'stratified':
        const stratifyColumn = document.getElementById('stratifiedColumn').value;
        const stratifiedSize = parseInt(document.getElementById('stratifiedSampleSize').value, 10);
        const stratifiedSeed = parseInt(document.getElementById('stratifiedSeed').value, 10);
        const stratifiedProportional = document.getElementById('stratifiedProportional').checked;

        sampleResult.parameters = {
          stratifyColumn: stratifyColumn,
          size: stratifiedSize,
          proportional: stratifiedProportional,
          seed: stratifiedSeed
        };

        try {
          // Получаем результат выборки
          const stratifiedSampleResult = window.SamplingMethods.stratified.sample(dataCopy, {
            stratifyColumn: stratifyColumn,
            sampleSize: stratifiedSize,
            proportional: stratifiedProportional,
            seed: stratifiedSeed || undefined
          });

          // Проверяем, что результат содержит population с отмеченными элементами
          if (stratifiedSampleResult && stratifiedSampleResult.population) {
            // Нормализуем значения is_sample для единообразия (всегда boolean)
            const normalizedPopulation = stratifiedSampleResult.population.map(item => ({
              ...item,
              is_sample: item.is_sample === 1 || item.is_sample === true
            }));

            sampleResult.data = normalizedPopulation;
            console.log('Стратифицированная выборка успешно создана:', stratifiedSampleResult);
          } else {
            throw new Error('Некорректный результат стратифицированной выборки');
          }
        } catch (e) {
          console.error('Ошибка при создании стратифицированной выборки:', e);
          showError(`Ошибка при создании стратифицированной выборки: ${e.message}`);
          // Используем запасной метод
          const backupResult = generateSimpleSample(dataCopy, {
            method: selectedMethod,
            size: stratifiedSize,
            seed: stratifiedSeed,
            stratifyColumn: stratifyColumn,
            proportional: stratifiedProportional
          });
          sampleResult.data = backupResult.data;
        }
        break;

      case 'mus':
        const musValueColumn = document.getElementById('musValueColumn').value;
        const musSize = parseInt(document.getElementById('musSampleSize').value, 10);
        const musSeed = parseInt(document.getElementById('musSeed').value, 10);
        const musStrataColumn = document.getElementById('musStrataColumn').value;
        const musIgnoreZeroValues = document.getElementById('musIgnoreZeroValues').checked;
        const musThreshold = document.getElementById('musThreshold').value ? parseFloat(document.getElementById('musThreshold').value) : null;

        sampleResult.parameters = {
          valueColumn: musValueColumn,
          size: musSize,
          seed: musSeed,
          strataColumn: musStrataColumn || null,
          ignoreZeroValues: musIgnoreZeroValues,
          threshold: musThreshold
        };

        try {
          // Получаем результат выборки
          const musSampleResult = window.SamplingMethods.monetaryUnit.sample(
            dataCopy,
            musSize,
            musValueColumn,
            {
              seed: musSeed || undefined,
              strataColumn: musStrataColumn || undefined,
              ignoreZeroValues: musIgnoreZeroValues,
              threshold: musThreshold
            }
          );

          // Проверяем, что результат содержит population с отмеченными элементами
          if (musSampleResult && musSampleResult.population) {
            // Нормализуем значения is_sample для единообразия (всегда boolean)
            const normalizedPopulation = musSampleResult.population.map(item => ({
              ...item,
              is_sample: item.is_sample === 1 || item.is_sample === true
            }));

            sampleResult.data = normalizedPopulation;
            console.log('Монетарная выборка успешно создана:', musSampleResult);
          } else {
            throw new Error('Некорректный результат монетарной выборки');
          }
        } catch (e) {
          console.error('Ошибка при создании монетарной выборки:', e);
          // Используем запасной метод
          const backupResult = generateSimpleSample(dataCopy, {
            method: selectedMethod,
            size: musSize,
            seed: musSeed
          });
          sampleResult.data = backupResult.data;
        }
        break;

      case 'isolationForest':
        // Определяем режим выборки и соответствующие параметры
        const useTopNMode = document.getElementById('useTopNMode').checked;

        // Параметры в зависимости от режима выборки
        let sampleSize, contamination;

        if (useTopNMode) {
          // Режим "Топ-N аномалий"
          sampleSize = parseInt(document.getElementById('topNSize').value, 10);

          // Проверка на корректность значения
          if (isNaN(sampleSize) || sampleSize <= 0) {
            showError('Размер выборки должен быть положительным числом');
            showLoading(generateBtn, false);
            return;
          }

          // Если выборка больше размера данных, ограничиваем её
          if (sampleSize > dataCopy.length) {
            sampleSize = dataCopy.length;
            showToast('warning', `Размер выборки ограничен количеством записей (${dataCopy.length})`);
          }

          // В этом режиме contamination определяется автоматически
          contamination = 'auto';
        } else {
          // Режим "Ожидаемая доля аномалий"
          contamination = parseFloat(document.getElementById('contamination').value);

          // Проверка на корректность значения
          if (isNaN(contamination) || contamination <= 0 || contamination > 0.5) {
            showError('Доля аномалий должна быть числом в диапазоне (0, 0.5]');
            showLoading(generateBtn, false);
            return;
          }

          // В этом режиме размер выборки определяется автоматически
          sampleSize = null;
        }

        // Получаем выбранные признаки с использованием матрицы выбора
        const selectedNumericalFeatures = getSelectedFeatures('numerical');
        const selectedCategoricalFeatures = getSelectedFeatures('categorical');

        // Проверяем, выбран ли хотя бы один признак
        if (selectedNumericalFeatures.length === 0 && selectedCategoricalFeatures.length === 0) {
          showError('Необходимо выбрать хотя бы один признак для анализа');
          showLoading(generateBtn, false);
          return;
        }

        sampleResult.parameters = {
          sampleSize: sampleSize,
          contamination: contamination,
          numericalFeatures: selectedNumericalFeatures,
          categoricalFeatures: selectedCategoricalFeatures
        };

        try {
          // Сохраняем оригинальные данные
          let originalData = JSON.parse(JSON.stringify(dataCopy));

          // Добавляем уникальный идентификатор для каждой записи
          originalData.forEach((item, index) => {
            item._record_id = index; // Добавляем уникальный ID для сопоставления
          });

          // Создаем копию данных для предобработки
          let processedData = JSON.parse(JSON.stringify(originalData));
          let preprocessDesc = '';
          let transformedFeatures = []; // Массив для хранения имен трансформированных признаков

          // Выполняем предобработку данных
          try {
            // Используем функцию препроцессинга из отдельного модуля
            if (typeof window.preprocessCategoricalFeatures === 'function') {
              console.log('Начинаем препроцессинг данных для ML:', {
                numericalFeatures: selectedNumericalFeatures,
                categoricalFeatures: selectedCategoricalFeatures
              });

              const preprocessResult = window.preprocessCategoricalFeatures(
                processedData,
                selectedNumericalFeatures,
                selectedCategoricalFeatures
              );

              // Получаем обработанные данные и список трансформированных признаков
              processedData = preprocessResult.data;
              preprocessDesc = preprocessResult.description;
              transformedFeatures = preprocessResult.features || [];

              console.log('Препроцессинг данных завершен:', {
                transformedFeatures,
                recordCount: processedData.length
              });
            } else {
              console.warn('Модуль препроцессинга недоступен');
              showToast('warning', 'Модуль препроцессинга недоступен. Выборка может быть некорректной.');
            }
          } catch (e) {
            console.error('Ошибка при предварительной обработке данных:', e);
            showToast('warning', 'Ошибка при обработке признаков. Выборка может быть некорректной.');
          }

          // Проверяем, что у нас есть признаки для использования
          if (transformedFeatures.length === 0) {
            throw new Error('Не удалось определить признаки для анализа после предобработки');
          }

          // Проверяем наличие метода isolationForest.sample
          if (!window.SamplingMethods || !window.SamplingMethods.isolationForest || typeof window.SamplingMethods.isolationForest.sample !== 'function') {
            throw new Error('Метод isolationForest.sample не найден. Возможно, модуль не загружен');
          }

          console.log('Запускаем Isolation Forest с трансформированными признаками:', transformedFeatures);

          // Получаем результат выборки, используя трансформированные признаки
          const isolationForestResult = window.SamplingMethods.isolationForest.sample(
            processedData,
            {
              sampleSize: sampleSize,
              contamination: contamination,
              features: transformedFeatures // Используем только трансформированные признаки
            }
          );

          // Проверяем, что результат содержит population с отмеченными элементами
          if (isolationForestResult && isolationForestResult.population) {
            // Переносим значения is_sample и anomaly_score из предобработанных данных в оригинальные
            // по идентификатору _record_id
            const processedResults = isolationForestResult.population;

            // Очищаем оригинальные данные от предыдущих результатов
            originalData.forEach(item => {
              item.is_sample = false;
              item.anomaly_score = null;
            });

            // Переносим значения из предобработанных данных в оригинальные
            processedResults.forEach(processedItem => {
              if (processedItem._record_id !== undefined) {
                const originalItem = originalData.find(item => item._record_id === processedItem._record_id);
                if (originalItem) {
                  originalItem.is_sample = processedItem.is_sample;
                  originalItem.anomaly_score = processedItem.anomaly_score;
                }
              }
            });

            // Теперь в originalData у нас оригинальные данные с полями is_sample и anomaly_score
            sampleResult.data = originalData;
            sampleResult.anomalyScores = isolationForestResult.anomalyScores;
            sampleResult.threshold = isolationForestResult.threshold;
            console.log('Выборка методом Isolation Forest успешно создана:', isolationForestResult);

            // Сохраняем предобработанные данные отдельно
            if (window.dataManager) {
              window.dataManager.setTransformedData(processedData, {
                type: 'isolation_forest_preprocessing',
                features: transformedFeatures,
                description: preprocessDesc || 'Предобработка для Isolation Forest'
              });
            }

            // Добавляем информацию о признаках в описание
            const methodDesc = isolationForestResult.methodDescription || '';

            // Если была предварительная обработка данных, добавляем информацию в описание
            let finalDescription = methodDesc;
            if (preprocessDesc) {
              finalDescription += '\n\nПредобработка данных:\n' + preprocessDesc;
            }

            // Добавляем информацию о выбранных признаках
            finalDescription += '\n\nВыбранные признаки:\n';

            if (selectedNumericalFeatures.length > 0) {
              finalDescription += 'Числовые: ' + selectedNumericalFeatures.join(', ') + '\n';
            }

            if (selectedCategoricalFeatures.length > 0) {
              finalDescription += 'Категориальные: ' + selectedCategoricalFeatures.join(', ') + '\n';
            }

            finalDescription += '\n\nИспользованные трансформированные признаки для обучения:\n' +
              transformedFeatures.join(', ');

            isolationForestResult.methodDescription = finalDescription;
          } else {
            throw new Error('Некорректный результат выборки методом Isolation Forest');
          }
        } catch (e) {
          console.error('Ошибка при создании выборки методом Isolation Forest:', e);
          showError(`Ошибка при создании выборки методом Isolation Forest: ${e.message}`);

          // Скрываем индикатор загрузки
          showLoading(generateBtn, false);
          return;
        }
        break;

      default:
        throw new Error('Неизвестный метод выборки');
    }

    // Сохраняем размер выборки в настройках
    chrome.storage.local.set({
      'defaultSampleSize': sampleResult.parameters.size
    });

    // Собираем метаданные о результате выборки
    const sampleItems = Array.isArray(sampleResult.data) ?
      sampleResult.data.filter(item => item && (item.is_sample === true || item.is_sample === 1)) : [];

    // Проверяем наличие элементов в выборке
    if (sampleItems.length === 0) {
      console.warn('Не обнаружено элементов в выборке! Исправляем проблему...');
      console.log('Данные для диагностики:');
      console.log('- Общее количество элементов:', Array.isArray(sampleResult.data) ? sampleResult.data.length : 0);

      if (Array.isArray(sampleResult.data) && sampleResult.data.length > 0) {
        console.log('- Первый элемент:', sampleResult.data[0]);
        console.log('- Типы значений is_sample:', [...new Set(sampleResult.data.map(item =>
          item && item.is_sample !== undefined ?
            `${item.is_sample} (${typeof item.is_sample})` : 'undefined'))]);
      }

      // Пытаемся добавить хотя бы несколько элементов в выборку
      if (Array.isArray(sampleResult.data) && sampleResult.data.length > 0) {
        const sampleSize = Math.min(sampleResult.parameters.size || 30, sampleResult.data.length);
        for (let i = 0; i < sampleSize; i++) {
          if (i < sampleResult.data.length) {
            sampleResult.data[i].is_sample = true;
          }
        }
        console.log(`Добавлено ${sampleSize} элементов в выборку вручную`);
      }
    }

    // Обновляем метаданные после возможного исправления
    const updatedSampleItems = Array.isArray(sampleResult.data) ?
      sampleResult.data.filter(item => item && (item.is_sample === true || item.is_sample === 1)) : [];

    sampleResult.result = {
      sampleSize: updatedSampleItems.length,
      totalSize: Array.isArray(sampleResult.data) ? sampleResult.data.length : 0,
      samplePercentage: (Array.isArray(sampleResult.data) && sampleResult.data.length > 0) ?
        (updatedSampleItems.length / sampleResult.data.length * 100).toFixed(2) + '%' : '0%'
    };

    // Сохраняем результаты выборки в dataManager
    if (window.dataManager) {
      if (window.dataManager.setSamplingResult) {
        window.dataManager.setSamplingResult(sampleResult.data, {
          method: selectedMethod,
          parameters: sampleResult.parameters,
          result: sampleResult.result,
          timestamp: new Date().toISOString()
        });
      } else {
        console.warn('Метод setSamplingResult не найден в dataManager, устанавливаем данные через window.data');
        window.data = sampleResult.data;
      }
    } else {
      // Для обратной совместимости
      window.data = sampleResult.data;
    }

    // Скрываем индикатор загрузки
    showLoading(generateBtn, false);

    // Отображаем результаты
    displayResults();

    // Обновляем предобработанные данные
    displayPreprocessedData();

    // Активируем кнопки экспорта
    enableExportButtons();

    // Показываем сообщение об успехе
    showSuccess(`Выборка успешно создана. Выбрано ${updatedSampleItems.length} элементов из ${sampleResult.data.length}.`);

    // Диагностика после создания выборки
    setTimeout(diagnoseDataState, 1000);

  } catch (error) {
    console.error('Ошибка при генерации выборки:', error);
    showError('Ошибка при генерации выборки: ' + error.message);

    // Скрываем индикатор загрузки
    const generateBtn = document.getElementById('generateSampleBtn');
    showLoading(generateBtn, false);
  }
}

/**
 * Встроенная функция для создания простой случайной выборки
 * Используется как запасной вариант, если библиотека методов не загружена
 */
function generateSimpleSample(items, method) {
  try {
    // Проверяем входные данные
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.error('Ошибка: generateSimpleSample получил невалидные данные', items);
      return {
        data: [],
        sampledItemsCount: 0,
        populationSize: 0
      };
    }

    console.log(`generateSimpleSample вызван для ${items.length} элементов, метод: ${method.method}`, method);

    let sampleSize;
    let selectedItems = [];

    // Получаем параметры в зависимости от метода
    switch (method.method) {
      case 'random':
        sampleSize = method.size || parseInt(document.getElementById('randomSampleSize').value, 10) || 30;
        break;
      case 'systematic':
        sampleSize = method.size || parseInt(document.getElementById('systematicSampleSize').value, 10) || 30;
        break;
      case 'stratified':
        sampleSize = method.size || parseInt(document.getElementById('stratifiedSampleSize').value, 10) || 30;

        // Если указана колонка для стратификации, пробуем выполнить базовую стратификацию
        if (method.stratifyColumn) {
          return generateSimpleStratifiedSample(
            items,
            method.size,
            method.stratifyColumn,
            method.proportional,
            method.seed
          );
        }
        break;
      case 'mus':
        sampleSize = method.size || parseInt(document.getElementById('musSampleSize').value, 10) || 30;
        break;
      default:
        sampleSize = method.size || 30; // По умолчанию
    }

    // Ограничиваем размер выборки количеством элементов
    if (sampleSize > items.length) {
      sampleSize = items.length;
      console.log(`Размер выборки ограничен до ${sampleSize} (все элементы)`);
    }

    // Для всех методов используем простой случайный алгоритм
    const shuffled = [...items].sort(() => 0.5 - Math.random());
    selectedItems = shuffled.slice(0, sampleSize);

    console.log(`Выбрано ${selectedItems.length} элементов для выборки`);

    // Маркируем выбранные элементы более надежным способом
    const selectedIds = new Set();

    // Создаем временные идентификаторы для выбранных элементов
    selectedItems.forEach((item, index) => {
      // Создаем уникальный идентификатор для каждого элемента, основанный на его содержимом
      const itemId = JSON.stringify(item);
      selectedIds.add(itemId);
    });

    // Маркируем элементы, используя созданные идентификаторы
    const result = items.map(item => {
      const itemWithoutSample = { ...item };
      delete itemWithoutSample.is_sample;

      const isInSample = selectedIds.has(JSON.stringify(itemWithoutSample));

      return {
        ...item,
        is_sample: isInSample ? true : false // Явно устанавливаем булево значение
      };
    });

    // Проверяем результат
    const sampledCount = result.filter(item => item.is_sample === true).length;
    console.log(`Маркировано ${sampledCount} элементов как выборка`);

    // Если что-то пошло не так и не получилось отметить элементы, пробуем запасной вариант
    if (sampledCount === 0 && sampleSize > 0) {
      console.warn('Не удалось пометить элементы выборки, используем запасной метод');
      // Отмечаем первые N элементов
      for (let i = 0; i < sampleSize && i < result.length; i++) {
        result[i].is_sample = true;
      }
    }

    return {
      data: result,
      sampledItemsCount: result.filter(item => item.is_sample === true).length,
      populationSize: items.length
    };
  } catch (error) {
    console.error('Ошибка в генерации простой выборки:', error);
    showError('Ошибка генерации выборки: ' + error.message);
    // Возвращаем исходные данные без выборки
    return {
      data: items.map(item => ({ ...item, is_sample: false })),
      sampledItemsCount: 0,
      populationSize: items.length
    };
  }
}

/**
 * Упрощенная реализация стратифицированной выборки
 */
function generateSimpleStratifiedSample(items, sampleSize, stratifyColumn, proportional = true, seed = 42) {
  console.log('Используется упрощенная реализация стратифицированной выборки', {
    items: items.length,
    sampleSize,
    stratifyColumn,
    proportional,
    seed
  });

  // Проверяем наличие колонки стратификации
  if (!stratifyColumn || !items.length || !(stratifyColumn in items[0])) {
    console.error(`Колонка "${stratifyColumn}" не найдена в данных`);
    return generateSimpleSample(items, { method: 'random', size: sampleSize, seed });
  }

  // Создаем ГПСЧ с указанным зерном
  const random = createSimplePRNG(seed);

  // Группируем данные по стратам
  const strata = {};
  items.forEach(item => {
    const stratumValue = item[stratifyColumn];
    if (!strata[stratumValue]) {
      strata[stratumValue] = [];
    }
    strata[stratumValue].push({ ...item });
  });

  const strataCount = Object.keys(strata).length;
  console.log(`Найдено ${strataCount} страт`);

  if (strataCount <= 1) {
    console.warn('Найдена только одна страта, используется простая случайная выборка');
    return generateSimpleSample(items, { method: 'random', size: sampleSize, seed });
  }

  // Выделяем размер выборки для каждой страты
  const totalSize = items.length;
  const strataSizes = {};
  let totalAllocated = 0;

  Object.entries(strata).forEach(([stratumValue, stratumItems]) => {
    const stratumSize = stratumItems.length;
    let stratumSampleSize;

    if (proportional) {
      // Пропорциональное распределение
      const proportion = stratumSize / totalSize;
      stratumSampleSize = Math.round(sampleSize * proportion);
    } else {
      // Равномерное распределение
      stratumSampleSize = Math.floor(sampleSize / strataCount);
    }

    // Не берем больше элементов, чем есть в страте
    stratumSampleSize = Math.min(stratumSampleSize, stratumSize);

    // Каждая страта должна получить хотя бы один элемент
    if (strataCount <= sampleSize && stratumSampleSize === 0 && stratumSize > 0) {
      stratumSampleSize = 1;
    }

    strataSizes[stratumValue] = stratumSampleSize;
    totalAllocated += stratumSampleSize;

    console.log(`Страта "${stratumValue}": размер=${stratumSize}, выборка=${stratumSampleSize}`);
  });

  // Распределяем оставшиеся элементы
  let remaining = sampleSize - totalAllocated;

  if (remaining !== 0) {
    console.log(`Требуется перераспределить ${remaining} элементов`);

    // Сортируем страты по размеру (от большей к меньшей)
    const sortedStrata = Object.entries(strata)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([stratumValue]) => stratumValue);

    // Добавляем или убираем элементы
    for (const stratumValue of sortedStrata) {
      if (remaining === 0) break;

      const stratumSize = strata[stratumValue].length;
      const currentSampleSize = strataSizes[stratumValue];

      if (remaining > 0) {
        // Добавляем элементы
        const availableSpace = stratumSize - currentSampleSize;
        if (availableSpace > 0) {
          const add = Math.min(remaining, availableSpace);
          strataSizes[stratumValue] += add;
          remaining -= add;
        }
      } else {
        // Убираем элементы
        const canRemove = currentSampleSize > 1 ? currentSampleSize - 1 : 0;
        if (canRemove > 0) {
          const remove = Math.min(Math.abs(remaining), canRemove);
          strataSizes[stratumValue] -= remove;
          remaining += remove;
        }
      }
    }
  }

  // Создаем копию элементов и отмечаем выбранные
  const result = items.map(item => ({ ...item, is_sample: false }));

  // Выбираем элементы из каждой страты
  Object.entries(strata).forEach(([stratumValue, stratumItems]) => {
    const stratumSampleSize = strataSizes[stratumValue];

    if (stratumSampleSize <= 0) return;

    // Перемешиваем страту
    const shuffled = [...stratumItems];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Отмечаем выбранные элементы
    for (let i = 0; i < stratumSampleSize; i++) {
      const selectedItem = shuffled[i];
      const index = result.findIndex(item =>
        Object.entries(selectedItem).every(([key, value]) =>
          key !== 'is_sample' && item[key] === value
        )
      );

      if (index !== -1) {
        result[index].is_sample = true;
      }
    }
  });

  // Подсчитываем выбранные элементы
  const selectedCount = result.filter(item => item.is_sample).length;

  console.log(`Выбрано ${selectedCount} элементов из ${result.length} (запрошено ${sampleSize})`);

  return {
    data: result,
    sampledItemsCount: selectedCount,
    populationSize: result.length
  };
}

/**
 * Создает простой псевдослучайный генератор чисел
 */
function createSimplePRNG(seed) {
  let state = seed || Math.floor(Math.random() * 1000000);

  return function () {
    const x = Math.sin(state++) * 10000;
    return x - Math.floor(x);
  };
}

/**
 * Получает название метода по его коду
 * @param {string} methodCode - Код метода
 * @returns {string} - Название метода на русском языке
 */
function getMethodName(methodCode) {
  const methodNames = {
    'random': 'Случайный отбор',
    'systematic': 'Систематический отбор',
    'stratified': 'Стратифицированный отбор',
    'mus': 'Монетарный отбор (MUS)',
    'isolationForest': 'Выявление аномалий (Isolation Forest)'
  };

  return methodNames[methodCode] || methodCode;
}

/**
 * Отображает результаты выборки
 */
function displayResults() {
  try {
    // Получаем данные для отображения
    let displayData;
    let sampleMetadata = {};

    if (window.dataManager) {
      // Используем dataManager для получения оригинальных данных
      displayData = window.dataManager.getOriginalData();

      // Проверяем наличие метода getSamplingMetadata
      if (window.dataManager.getSamplingMetadata) {
        sampleMetadata = window.dataManager.getSamplingMetadata();
      } else {
        console.warn('Метод getSamplingMetadata не найден в dataManager');
      }
    } else {
      // Для обратной совместимости
      displayData = window.data;
    }

    // Проверяем наличие данных
    if (!displayData || !Array.isArray(displayData) || displayData.length === 0) {
      console.error('Нет данных для отображения результатов');
      document.getElementById('sampleResults').innerHTML = `
        <div class="alert alert-danger">
          <div class="d-flex align-items-center">
            <strong>Ошибка! Нет данных для отображения результатов</strong>
          </div>
        </div>
      `;
      return;
    }

    // Получаем элементы выборки
    const sampleItems = displayData.filter(item => item.is_sample === true);
    const sampleCount = sampleItems.length;
    const totalCount = displayData.length;

    // Если нет элементов выборки
    if (sampleCount === 0) {
      console.error('Нет элементов выборки для отображения');
      document.getElementById('sampleResults').innerHTML = `
        <div class="alert alert-warning">
          <div class="d-flex align-items-center">
            <span class="material-icons me-2">warning</span>
            <strong>Внимание!</strong> Нет элементов выборки для отображения
          </div>
        </div>
      `;
      return;
    }

    // Вычисляем процент выборки
    const samplePercentage = (sampleCount / totalCount * 100).toFixed(2);

    // Отображаем статистику выборки
    document.getElementById('sampleStats').innerHTML = `
      <div class="d-flex">
        <span class="badge bg-primary me-2">Записей: ${totalCount}</span>
        <span class="badge bg-success me-2">В выборке: ${sampleCount}</span>
        <span class="badge bg-info">${samplePercentage}%</span>
      </div>
    `;

    // Получаем метод выборки для отображения
    let methodName = "Не указан";
    if (sampleMetadata && sampleMetadata.method) {
      methodName = getMethodName(sampleMetadata.method);
    }

    // Определяем, является ли текущий метод Isolation Forest
    const isIsolationForestMethod = sampleMetadata && sampleMetadata.method === 'isolationForest';

    // Создаем таблицу для отображения результатов
    const originalHeaders = getHeaders(displayData[0]);

    // Игнорируем служебное поле _record_id, is_sample и anomaly_score при построении остальных заголовков
    const headers = originalHeaders.filter(header =>
      header !== '_record_id' && header !== 'is_sample' && header !== 'anomaly_score'
    );

    let tableHTML = `
      <div class="sample-method-info mb-3">
        <span class="badge bg-secondary">Метод выборки: ${methodName}</span>
      </div>
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead>
            <tr>
              <th scope="col" class="text-center" style="width: 70px;">#</th>
              <th scope="col" class="text-center" style="width: 120px;">is_sample</th>
              ${isIsolationForestMethod ? '<th scope="col" class="text-center" style="width: 140px;">anomaly_score</th>' : ''}
              ${headers.map(h => `<th scope="col" class="text-center">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    // Ограничиваем количество отображаемых строк до 100
    const maxRows = 100;
    const displayLimit = Math.min(displayData.length, maxRows);
    const displayDataLimited = displayData.slice(0, displayLimit);

    // Добавляем строки данных
    displayDataLimited.forEach((item, index) => {
      const isInSample = item.is_sample === true;

      // Определяем класс строки и статус
      let rowClass = '';
      let statusBadge = '';

      if (isInSample) {
        rowClass = 'table-success';
        statusBadge = '<span class="badge bg-success">В выборке</span>';
      } else {
        statusBadge = '<span class="badge bg-secondary">Не выбран</span>';
      }

      // Форматируем anomaly_score
      let anomalyScoreValue = 'N/A';
      if (item.anomaly_score !== undefined) {
        anomalyScoreValue = typeof item.anomaly_score === 'number' ? item.anomaly_score.toFixed(4) : item.anomaly_score;
      }

      tableHTML += `
        <tr class="${rowClass}">
          <td class="text-center">${index + 1}</td>
          <td class="text-center">${statusBadge}</td>
          ${isIsolationForestMethod ? `<td class="text-center">${anomalyScoreValue}</td>` : ''}
          ${headers.map(header => {
        let cellValue = item[header] !== undefined ? item[header] : '';
        return `<td class="text-center">${cellValue}</td>`;
      }).join('')}
        </tr>
      `;
    });

    // Добавляем информационное сообщение, если не все данные отображаются
    if (displayData.length > maxRows) {
      const colSpan = 2 + (isIsolationForestMethod ? 1 : 0) + headers.length;
      tableHTML += `
        <tr class="table-secondary">
          <td colspan="${colSpan}" class="text-center py-3">
            <span class="text-muted">
              <span class="material-icons small align-middle me-1">info</span>
              Показаны первые ${maxRows} из ${displayData.length} записей
            </span>
          </td>
        </tr>
      `;
    }

    tableHTML += `
          </tbody>
        </table>
      </div>
    `;

    // Обновляем содержимое элемента результатов
    document.getElementById('sampleResults').innerHTML = tableHTML;

    // Активируем кнопки экспорта
    document.getElementById('exportCsvBtn').disabled = false;
    document.getElementById('exportExcelBtn').disabled = false;

  } catch (error) {
    console.error('Ошибка при отображении результатов:', error);
    document.getElementById('sampleResults').innerHTML = `
      <div class="alert alert-danger">
        <div class="d-flex align-items-center">
          <span class="material-icons me-2">error</span>
          <strong>Ошибка!</strong> ${error.message}
        </div>
      </div>
    `;
  }
}

/**
 * Экспортирует данные в файл указанного формата
 * @param {Array} dataToExport - Данные для экспорта
 * @param {string} format - Формат экспорта ('csv' или 'xlsx')
 */
function exportDataFile(dataToExport, format) {
  try {
    // Проверка данных перед началом экспорта
    console.log('exportDataFile вызвана с данными:', dataToExport);
    console.log('Формат экспорта:', format);

    if (!dataToExport || !Array.isArray(dataToExport) || dataToExport.length === 0) {
      console.error('Ошибка: передан пустой или невалидный массив данных');
      showMessage('Ошибка: нет данных для экспорта', 'error');
      return;
    }

    // Определяем, экспортируем все данные или только выборку
    const isExportingSample = document.querySelector('input[name="exportType"]:checked').value === 'sample';

    // Фильтруем данные в соответствии с выбранным типом экспорта
    const exportData = isExportingSample
      ? dataToExport.filter(item => item.is_sample)
      : dataToExport;

    console.log(`Экспорт ${isExportingSample ? 'выборки' : 'полной популяции'}, формат: ${format}`);
    console.log(`Количество записей для экспорта: ${exportData.length}`);

    // Проверяем, есть ли данные для экспорта
    if (!exportData || exportData.length === 0) {
      showMessage(`Нет данных для экспорта. ${isExportingSample ? 'Выборка' : 'Популяция'} пуста.`, 'error');
      return;
    }

    // Показываем индикатор загрузки на кнопке экспорта
    const exportBtn = format === 'csv'
      ? document.getElementById('exportCsvBtn')
      : document.getElementById('exportExcelBtn');

    showLoading(exportBtn, true);

    // Создаем имя файла с датой
    const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const sampleType = isExportingSample ? 'sample' : 'population';
    const method = document.getElementById('sampleMethodSelect').value;
    let filename = `${sampleType}_${method}_${dateStr}`;

    // Получаем заголовки для экспорта (исключая служебные поля)
    const headers = getHeaders(exportData[0]).filter(header =>
      !['is_sample', '_record_id'].includes(header)
    );

    // Проверяем наличие ExportFunctions
    if (!window.ExportFunctions) {
      console.error('Модуль ExportFunctions не загружен');
      showMessage('Ошибка: модуль экспорта не загружен', 'error');
      showLoading(exportBtn, false);
      return;
    }

    // Выбираем метод экспорта в зависимости от формата
    let fileData, fileType;

    if (format === 'csv') {
      filename += '.csv';
      fileType = 'text/csv';

      fileData = window.ExportFunctions.exportToCSV(exportData, headers);
      if (!fileData) {
        showMessage('Ошибка при формировании CSV файла', 'error');
        showLoading(exportBtn, false);
        return;
      }
    } else if (format === 'xlsx') {
      filename += '.xlsx';
      fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      fileData = window.ExportFunctions.exportToXLSX(exportData, headers);
      if (!fileData) {
        showMessage('Ошибка при формировании Excel файла', 'error');
        showLoading(exportBtn, false);
        return;
      }
    } else {
      showMessage(`Неподдерживаемый формат: ${format}`, 'error');
      showLoading(exportBtn, false);
      return;
    }

    // Отправляем данные для скачивания
    window.ExportFunctions.sendDataForDownload(fileData, filename, fileType)
      .then(response => {
        showLoading(exportBtn, false);
        console.log('Файл успешно отправлен на скачивание:', response);
        showMessage(`Файл ${filename} успешно экспортирован`, 'success');
      })
      .catch(error => {
        showLoading(exportBtn, false);
        console.error('Ошибка при скачивании файла:', error);
        showMessage('Ошибка при скачивании файла: ' + error.message, 'error');
      });

  } catch (error) {
    const exportBtn = format === 'csv'
      ? document.getElementById('exportCsvBtn')
      : document.getElementById('exportExcelBtn');

    showLoading(exportBtn, false);
    console.error('Ошибка при экспорте файла:', error);
    showMessage('Ошибка при экспорте: ' + error.message, 'error');
  }
}

/**
 * Получает заголовки данных, исключая служебные поля
 * @param {Object} dataObject - Объект данных
 * @returns {Array} Массив заголовков
 */
function getHeaders(dataObject) {
  if (!dataObject) return [];

  // Получаем все ключи, кроме is_sample
  return Object.keys(dataObject).filter(key => key !== 'is_sample');
}

/**
 * Отображает сообщение для пользователя
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип сообщения ('success', 'error', 'info')
 */
function showMessage(message, type = 'info') {
  if (!message) return;

  const messagesContainer = document.getElementById('messages');
  if (!messagesContainer) return;

  // Создаем элемент сообщения
  const messageElement = document.createElement('div');
  messageElement.className = `message ${type}`;

  // Добавляем иконку в зависимости от типа
  let icon = 'info';
  if (type === 'success') icon = 'check_circle';
  if (type === 'error') icon = 'error';

  messageElement.innerHTML = `
    <span class="material-icons me-2">${icon}</span>
    ${message}
  `;

  // Добавляем сообщение в контейнер
  messagesContainer.appendChild(messageElement);

  // Удаляем сообщение через 5 секунд
  setTimeout(() => {
    messageElement.style.opacity = '0';
    messageElement.style.transform = 'translateX(30px)';

    setTimeout(() => {
      if (messageElement.parentNode === messagesContainer) {
        messagesContainer.removeChild(messageElement);
      }
    }, 300);
  }, 5000);
}

/**
 * Показывает сообщение об ошибке
 * @param {string} message - Текст сообщения об ошибке
 */
function showError(message) {
  showMessage(message, 'error');
}

/**
 * Обновляет информацию о загруженных данных
 * @param {Object} info - Информация о данных
 */
function updateDataInfo(info) {
  console.log('updateDataInfo вызван, window.selectedFileInfo =', window.selectedFileInfo, 'переданный info =', info);
  // Объединяем данные из глобальной переменной с переданными данными, если window.selectedFileInfo отсутствует, используем пустой объект
  info = Object.assign({}, window.selectedFileInfo || {}, info);
  const dataInfo = document.getElementById('dataInfo');
  if (!dataInfo) return;

  // Определяем иконку в зависимости от типа файла
  let fileIcon = 'description';
  const extension = info.name ? info.name.split('.').pop().toLowerCase() : '';

  if (['xlsx', 'xls'].includes(extension)) {
    fileIcon = 'table_view';
  } else if (extension === 'csv') {
    fileIcon = 'grid_on';
  }

  dataInfo.innerHTML = `
    <div class="alert alert-success">
      <div class="d-flex align-items-center">
        <span class="material-icons me-2">${fileIcon}</span>
        <div>
          <strong class="d-block mb-1">${info.name}</strong>
          <div class="d-flex gap-2">
            <span class="badge bg-primary">Записей: ${info.records}</span>
            <span class="badge bg-info">Колонок: ${info.columns}</span>
            <span class="badge bg-secondary">${formatFileSize(info.size)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Функция для диагностики состояния данных
function diagnoseDataState() {
  console.log('=== ДИАГНОСТИКА ДАННЫХ ===');
  console.log('window.data:', window.data);
  console.log('typeof window.data:', typeof window.data);
  console.log('Массив?', Array.isArray(window.data));
  console.log('Длина:', window.data ? window.data.length : 'нет данных');

  if (window.data && Array.isArray(window.data) && window.data.length > 0) {
    const sampleItems = window.data.filter(item => item.is_sample === true);
    console.log('Элементов в выборке:', sampleItems.length);
    console.log('Первый элемент:', window.data[0]);
  }

  // Проверка доступности кнопок экспорта
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportExcelBtn = document.getElementById('exportExcelBtn');

  console.log('Кнопка CSV отключена:', exportCsvBtn ? exportCsvBtn.disabled : 'не найдена');
  console.log('Кнопка Excel отключена:', exportExcelBtn ? exportExcelBtn.disabled : 'не найдена');

  // Проверка загрузки XLSX
  console.log('XLSX загружен:', typeof XLSX !== 'undefined');

  return true;
}

// Перехватываем и исправляем возможные проблемы с данными
function ensureGlobalData() {
  // Проверяем наличие dataManager
  if (typeof window.dataManager !== 'undefined') {
    // Используем правильный метод получения данных
    const dataManagerData = window.dataManager.getOriginalData ?
      window.dataManager.getOriginalData() : [];

    // Проверяем, корректны ли данные
    if (!Array.isArray(dataManagerData)) {
      console.warn('DataManager.getOriginalData() не является массивом, инициализируем его');
      if (window.dataManager.setOriginalData) {
        window.dataManager.setOriginalData([]);
      }
    }

    // Синхронизируем window.data с dataManager
    window.data = dataManagerData;
  } else {
    // Если dataManager отсутствует, но есть window.data
    if (typeof window.data === 'undefined') {
      console.warn('window.data не определена, инициализируем её');
      window.data = [];
    } else if (!Array.isArray(window.data)) {
      console.warn('window.data не является массивом, инициализируем его');
      window.data = window.data ? [window.data] : [];
    }

    // Создаем dataManager, если его нет
    if (typeof window.dataManager === 'undefined') {
      console.warn('Создаем dataManager, так как он отсутствует');
      window.dataManager = createBasicDataManager();
    }
  }

  return window.data;
}

/**
 * Создает dataManager, если он не существует или не имеет нужных методов
 */
function ensureDataManager() {
  // Если dataManager не существует, создаем его
  if (!window.dataManager) {
    console.warn('Создаем dataManager, так как он отсутствует');
    window.dataManager = createBasicDataManager();
    return;
  }

  // Проверяем наличие необходимых методов
  const requiredMethods = [
    'getOriginalData',
    'setOriginalData',
    'getSampleData',
    'setSamplingResult',
    'getSamplingMetadata'
  ];

  const missingMethods = requiredMethods.filter(
    method => typeof window.dataManager[method] !== 'function'
  );

  // Если есть отсутствующие методы, пересоздаем dataManager
  if (missingMethods.length > 0) {
    console.warn('В dataManager отсутствуют методы:', missingMethods.join(', '));
    console.warn('Пересоздаем dataManager с необходимыми методами');

    // Сохраняем текущие данные, если они есть
    const originalData = window.dataManager.getOriginalData
      ? window.dataManager.getOriginalData()
      : window.data || [];

    // Создаем новый dataManager
    window.dataManager = createBasicDataManager();

    // Восстанавливаем данные
    window.dataManager.setOriginalData(originalData);
  }
}

/**
 * Создает базовую версию dataManager с необходимыми методами
 */
function createBasicDataManager() {
  return {
    state: {
      originalData: Array.isArray(window.data) ? window.data : [],
      sampleData: Array.isArray(window.data)
        ? window.data.filter(item => item && (item.is_sample === true || item.is_sample === 1))
        : [],
      samplingMetadata: {
        method: null,
        parameters: {},
        result: {},
        timestamp: null
      }
    },
    getOriginalData: function () {
      return this.state.originalData;
    },
    setOriginalData: function (data) {
      this.state.originalData = Array.isArray(data) ? data : [];
      window.data = this.state.originalData;
    },
    getSampleData: function () {
      return this.state.sampleData;
    },
    setSamplingResult: function (data, metadata = {}) {
      this.state.originalData = Array.isArray(data) ? data : [];
      this.state.sampleData = this.state.originalData.filter(
        item => item && (item.is_sample === true || item.is_sample === 1)
      );
      this.state.samplingMetadata = {
        ...this.state.samplingMetadata,
        ...metadata
      };
      window.data = this.state.originalData;
    },
    getSamplingMetadata: function () {
      return this.state.samplingMetadata;
    }
  };
}

// Вызываем функцию обеспечения данных каждую секунду
setInterval(ensureGlobalData, 1000);

/**
 * Служебная функция для принудительной активации кнопок экспорта
 * Вызывается для устранения проблем с экспортом
 */
function forciblyEnableExportButtons() {
  console.log('Принудительная активация кнопок экспорта');

  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportExcelBtn = document.getElementById('exportExcelBtn');

  if (exportCsvBtn) {
    exportCsvBtn.disabled = false;
    exportCsvBtn.classList.remove('btn-disabled');
    exportCsvBtn.classList.add('btn-active');
    exportCsvBtn.style.opacity = '1';
    exportCsvBtn.style.cursor = 'pointer';
    console.log('Кнопка CSV активирована принудительно');
  }

  if (exportExcelBtn) {
    if (typeof XLSX !== 'undefined') {
      exportExcelBtn.disabled = false;
      exportExcelBtn.classList.remove('btn-disabled');
      exportExcelBtn.classList.add('btn-active');
      exportExcelBtn.style.opacity = '1';
      exportExcelBtn.style.cursor = 'pointer';
      console.log('Кнопка Excel активирована принудительно');
    } else {
      console.log('Библиотека XLSX не загружена, кнопка Excel остается неактивной');
    }
  }
}

// Вызываем функцию активации кнопок экспорта после загрузки всех данных
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(forciblyEnableExportButtons, 5000);

  // Повторяем каждые 10 секунд для надежности
  setInterval(function () {
    // Активируем только если есть данные и выборка
    if (window.data && Array.isArray(window.data) &&
      window.data.length > 0 &&
      window.data.some(item => item.is_sample === true)) {
      forciblyEnableExportButtons();
    }
  }, 10000);
});

/**
 * Показывает индикатор загрузки на указанном элементе
 * @param {HTMLElement} element - Элемент, на котором нужно показать загрузку
 * @param {boolean} show - Показать или скрыть индикатор загрузки
 */
function showLoader(element, show = true) {
  if (!element) {
    console.error('showLoader: элемент не передан');
    return;
  }

  if (show) {
    // Сохраняем оригинальное содержимое
    const originalContent = element.innerHTML;
    element.setAttribute('data-original-content', originalContent);

    // Добавляем индикатор загрузки
    const loaderHTML = `
      <div class="loading-container">
        <span class="loading-spinner"></span>
        <span class="loading-text">Загрузка...</span>
      </div>
    `;
    element.innerHTML = loaderHTML;
  } else {
    // Восстанавливаем оригинальное содержимое
    const originalContent = element.getAttribute('data-original-content');
    if (originalContent) {
      element.innerHTML = originalContent;
      element.removeAttribute('data-original-content');
    }
  }
}

// Обработчик события data-changed
document.addEventListener('DOMContentLoaded', function () {
  // Подписываемся на событие изменения данных
  if (window.dataManager) {
    window.dataManager.addEventListener('data-changed', function (state) {
      // Получаем данные из состояния
      const originalData = state.originalData || [];

      // Обновляем селекторы колонок
      updateColumnSelectors();

      // Обновляем информацию о данных
      updateDataInfo({
        records: originalData.length,
        columns: originalData.length > 0 ? Object.keys(originalData[0]).length : 0
      });

      // Активируем кнопку генерации выборки, если есть данные
      const generateSampleBtn = document.getElementById('generateSampleBtn');
      if (generateSampleBtn) {
        generateSampleBtn.disabled = !(originalData && originalData.length > 0);
      }
    });

    // Подписываемся на событие создания выборки
    window.dataManager.addEventListener('sample-created', function (sampleData) {
      // Активируем кнопки экспорта, если есть данные выборки
      const exportCsvBtn = document.getElementById('exportCsvBtn');
      const exportExcelBtn = document.getElementById('exportExcelBtn');

      if (exportCsvBtn) {
        exportCsvBtn.disabled = false;
      }

      if (exportExcelBtn && typeof XLSX !== 'undefined') {
        exportExcelBtn.disabled = false;
      }
    });
  }
});

/**
 * Отображает сообщение об успехе
 * @param {string} message - Текст сообщения
 */
function showSuccess(message) {
  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) {
    console.error('Контейнер для уведомлений не найден');
    return;
  }

  // Создаем элемент уведомления
  const alertElement = document.createElement('div');
  alertElement.className = 'alert alert-success alert-dismissible fade show';
  alertElement.role = 'alert';

  alertElement.innerHTML = `
    <div class="d-flex align-items-center">
      <span>${message}</span>
    </div>
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  // Добавляем уведомление в контейнер
  alertContainer.appendChild(alertElement);

  // Автоматически скрываем через 5 секунд
  setTimeout(() => {
    alertElement.classList.remove('show');
    setTimeout(() => {
      alertContainer.removeChild(alertElement);
    }, 300);
  }, 5000);
}

/**
 * Активирует кнопки экспорта данных
 */
function enableExportButtons() {
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportExcelBtn = document.getElementById('exportExcelBtn');

  if (exportCsvBtn) {
    exportCsvBtn.disabled = false;
    exportCsvBtn.classList.add('btn-active');
    exportCsvBtn.style.opacity = '1';
    exportCsvBtn.style.cursor = 'pointer';
    exportCsvBtn.style.backgroundColor = '#34A853';
    console.log('Кнопка CSV активирована');
  }

  if (exportExcelBtn) {
    exportExcelBtn.disabled = false;
    exportExcelBtn.classList.add('btn-active');
    exportExcelBtn.style.opacity = '1';
    exportExcelBtn.style.cursor = 'pointer';
    exportExcelBtn.style.backgroundColor = '#34A853';
    console.log('Кнопка Excel активирована');
  }
}

/**
 * Переключает видимость элементов в зависимости от режима выборки
 * (Топ-N аномалий или ожидаемая доля аномалий)
 */
function toggleSamplingMode() {
  const useTopNMode = document.getElementById('useTopNMode');
  const topNContainer = document.getElementById('topNContainer');
  const contaminationContainer = document.getElementById('contaminationContainer');

  if (useTopNMode && topNContainer && contaminationContainer) {
    if (useTopNMode.checked) {
      // Режим "Топ-N аномалий"
      topNContainer.style.display = 'flex';
      contaminationContainer.style.display = 'none';
    } else {
      // Режим "Ожидаемая доля аномалий"
      topNContainer.style.display = 'none';
      contaminationContainer.style.display = 'flex';
    }
  }
}

/**
 * Настраивает интерфейс для метода Isolation Forest
 */
function setupIsolationForestUI() {
  // Обработчик для переключателя режима выборки
  const useTopNMode = document.getElementById('useTopNMode');
  if (useTopNMode) {
    useTopNMode.addEventListener('change', toggleSamplingMode);
    // Инициализируем состояние интерфейса
    toggleSamplingMode();
  }
}

/**
 * Показывает уведомление пользователю
 * 
 * @param {string} type - Тип уведомления ('success', 'warning', 'error', 'info')
 * @param {string} message - Текст сообщения
 * @param {number} [timeout=3000] - Время показа в миллисекундах
 */
function showToast(type, message, timeout = 3000) {
  // Создаем контейнер для toast, если его нет
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(toastContainer);
  }

  // Определяем цвет в зависимости от типа
  const bgClass = {
    'success': 'bg-success',
    'warning': 'bg-warning',
    'error': 'bg-danger',
    'info': 'bg-info'
  }[type] || 'bg-secondary';

  // Создаем toast элемент
  const toastId = 'toast-' + Date.now();
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center ${bgClass} text-white" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Закрыть"></button>
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML('beforeend', toastHtml);

  // Инициализируем toast
  const toastElement = document.getElementById(toastId);
  const bsToast = new bootstrap.Toast(toastElement, {
    delay: timeout,
    autohide: true
  });

  // Показываем toast
  bsToast.show();

  // Удаляем toast после закрытия
  toastElement.addEventListener('hidden.bs.toast', function () {
    this.remove();
  });
}

/**
 * Отображает предобработанные данные на соответствующей вкладке
 */
function displayPreprocessedData() {
  try {
    // Получаем предобработанные данные
    let preprocessedData;
    let transformationInfo = {};
    let originalColumns = []; // Список оригинальных колонок

    if (window.dataManager) {
      // Используем dataManager для получения данных
      preprocessedData = window.dataManager.getTransformedData();

      // Получаем информацию о преобразованиях
      if (window.dataManager.state && window.dataManager.state.mlMetadata) {
        transformationInfo = window.dataManager.state.mlMetadata.transformations[
          window.dataManager.state.mlMetadata.transformations.length - 1
        ] || {};
      }

      // Получаем оригинальные колонки из оригинальных данных
      const originalData = window.dataManager.getOriginalData();
      if (originalData && originalData.length > 0) {
        originalColumns = Object.keys(originalData[0]);
      }
    } else {
      console.warn('dataManager недоступен для получения предобработанных данных');
    }

    // Проверяем наличие данных
    if (!preprocessedData || !Array.isArray(preprocessedData) || preprocessedData.length === 0) {
      console.warn('Нет предобработанных данных для отображения');
      document.getElementById('preprocessedResults').innerHTML = `
        <div class="alert alert-info">
          <div class="d-flex align-items-center">
            <span class="material-icons me-2">info</span>
            <span>Детализированные данные отсутствуют. Выберите метод машинного обучения и сформируйте выборку.</span>
          </div>
        </div>
      `;
      return;
    }

    // Получаем контейнеры для отображения результатов
    const preprocessedStatsContainer = document.getElementById('preprocessedStats');
    const preprocessedResultsContainer = document.getElementById('preprocessedResults');
    if (!preprocessedStatsContainer || !preprocessedResultsContainer) return;

    // Отображаем статистику о предобработанных данных
    let statsHtml = `
      <div class="card mb-4">
        <div class="card-header bg-primary text-white">
          <h5 class="mb-0">
            <span class="material-icons align-middle me-2">analytics</span>
            Данные для машинного обучения
          </h5>
        </div>
        <div class="card-body">
          <div class="d-flex flex-wrap gap-2 mb-3">
            <span class="badge bg-primary">Записей: ${preprocessedData.length}</span>
            <span class="badge bg-info">Признаков: ${transformationInfo.features ? transformationInfo.features.length : 'N/A'}</span>
            <span class="badge bg-secondary">Метод: Isolation Forest</span>
          </div>
    `;

    // Добавляем описание преобразований, если оно есть
    if (transformationInfo.description) {
      statsHtml += `
        <div class="alert alert-light mb-3">
          <h6 class="fw-bold">Информация о предобработке:</h6>
          <div class="small">${transformationInfo.description.replace(/\n/g, '<br>')}</div>
        </div>
      `;
    }

    // Добавляем информацию о использованных признаках
    if (transformationInfo.features && transformationInfo.features.length > 0) {
      statsHtml += `
        <div class="mb-3">
          <h6 class="fw-bold">Использованные признаки для обучения:</h6>
          <div class="d-flex flex-wrap gap-1 mb-2">
            ${transformationInfo.features.map(feature =>
        `<span class="badge bg-light text-dark">${feature}</span>`
      ).join('')}
          </div>
        </div>
      `;
    }

    // Закрываем секцию статистики
    statsHtml += `
          <div class="alert alert-success">
            <span class="material-icons align-middle me-2">info</span>
            <p>Это датасет, который прошел предобработку и использовался для обучения Isolation Forest.
            <strong>Isolation Forest обучается ТОЛЬКО на преобразованных колонках (выделены в таблице).</strong></p>
            <ul class="mt-2 mb-0">
              <li><strong>Числовые признаки</strong> (с префиксом "_") нормализованы в диапазоне [0, 1]</li>
              <li><strong>Категориальные признаки</strong> преобразованы в бинарные колонки (one-hot encoding)</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    // Получаем первый элемент данных для анализа колонок
    const firstItem = preprocessedData[0];

    // Определяем все колонки в предобработанных данных
    const allColumns = Object.keys(firstItem);

    // Определяем, какие колонки используются для обучения
    const usedFeatures = transformationInfo.features || [];

    // Выделяем преобразованные колонки (с префиксом '_')
    const transformedColumns = allColumns.filter(col =>
      col.startsWith('_') && col !== '_record_id'
    );

    // Выделяем оригинальные колонки (без префикса '_')
    const dataOriginalColumns = allColumns.filter(col =>
      !col.startsWith('_') && col !== 'is_sample' && col !== 'anomaly_score' && col !== '_record_id'
    );

    // Формируем порядок колонок
    let orderedColumns = [];

    // Сначала _record_id, если есть
    if (allColumns.includes('_record_id')) {
      orderedColumns.push('_record_id');
    }

    // Затем оригинальные колонки
    dataOriginalColumns.forEach(col => {
      orderedColumns.push(col);
    });

    // Добавляем трансформированные колонки
    transformedColumns.forEach(col => {
      orderedColumns.push(col);
    });

    // Добавляем is_sample и anomaly_score в конец, если они есть
    // Но для стабильности порядка добавим их в любом случае
    const specialColumns = ['is_sample', 'anomaly_score'];
    specialColumns.forEach(col => {
      // Удалим колонку, если она уже есть в списке (чтобы не было дублирования)
      const existingIndex = orderedColumns.indexOf(col);
      if (existingIndex !== -1) {
        orderedColumns.splice(existingIndex, 1);
      }

      // Добавим колонку в конец списка
      orderedColumns.push(col);
    });

    // Подготавливаем таблицу для отображения данных
    let tableHtml = `
      <div class="card">
        <div class="card-header bg-dark text-white">
          <h5 class="mb-0">
            <span class="material-icons align-middle me-2">table_chart</span>
            Предобработанные данные
          </h5>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-striped table-hover mb-0">
              <thead class="table-dark">
                <tr>
    `;

    // Добавляем заголовки колонок в заданном порядке
    orderedColumns.forEach(header => {
      const isUsedFeature = usedFeatures.includes(header);
      const isTransformed = header.startsWith('_') && header !== '_record_id';
      const isOriginal = !header.startsWith('_') && header !== 'is_sample' && header !== 'anomaly_score';
      const isSpecial = specialColumns.includes(header);

      // Определяем, является ли это нормализованным числовым признаком
      const isNormalizedNumeric = isTransformed && !header.substring(1).includes('_');

      // Определяем стиль заголовка
      let headerClass;
      if (isUsedFeature) {
        headerClass = 'bg-primary text-white'; // Колонки для обучения
      } else if (isNormalizedNumeric) {
        headerClass = 'bg-info text-white'; // Нормализованные числовые признаки
      } else if (isTransformed && !isNormalizedNumeric) {
        headerClass = 'bg-secondary text-white'; // Бинарные признаки
      } else if (isOriginal) {
        headerClass = 'table-secondary'; // Оригинальные колонки
      } else if (isSpecial) {
        headerClass = 'bg-success text-white'; // Специальные колонки (is_sample, anomaly_score)
      } else {
        headerClass = ''; // Прочие колонки
      }

      // Определяем отображаемое имя
      const displayName = header;

      // Добавляем бейдж для колонок, используемых в обучении
      let badge = '';
      if (isUsedFeature) {
        badge = ' <span class="badge bg-warning text-dark" title="Используется для обучения">ML</span>';
      } else if (isNormalizedNumeric) {
        badge = ' <span class="badge bg-light text-dark" title="Нормализованная числовая колонка">Norm</span>';
      } else if (isTransformed && !isNormalizedNumeric) {
        badge = ' <span class="badge bg-light text-dark" title="Бинарная трансформированная колонка">OHE</span>';
      } else if (isOriginal) {
        badge = ' <span class="badge bg-light text-dark" title="Оригинальная колонка">O</span>';
      } else if (isSpecial) {
        badge = ' <span class="badge bg-light text-dark" title="Служебная колонка">S</span>';
      }

      tableHtml += `<th scope="col" class="${headerClass}">${displayName}${badge}</th>`;
    });

    tableHtml += `
                </tr>
              </thead>
              <tbody>
    `;

    // Добавляем первые 10 строк данных
    const maxRows = Math.min(preprocessedData.length, 10);
    for (let i = 0; i < maxRows; i++) {
      const item = preprocessedData[i];
      // Определяем класс строки в зависимости от того, входит ли элемент в выборку
      const isInSample = item.is_sample === true;
      const rowClass = isInSample ? 'table-success' : '';

      tableHtml += `<tr class="${rowClass}">`;

      // Добавляем ячейки в заданном порядке
      orderedColumns.forEach(header => {
        const value = item[header];
        const isUsedFeature = usedFeatures.includes(header);
        const isTransformed = header.startsWith('_') && header !== '_record_id';
        const isOriginal = !header.startsWith('_') && header !== 'is_sample' && header !== 'anomaly_score';
        const isSpecial = specialColumns.includes(header);

        // Определяем, является ли это нормализованным числовым признаком
        const isNormalizedNumeric = isTransformed && !header.substring(1).includes('_');

        // Форматируем значение в зависимости от его типа
        let formattedValue;
        if (value === null || value === undefined) {
          // Если значения нет, но это особые колонки, используем default значения
          if (header === 'is_sample') {
            formattedValue = '<span class="badge bg-secondary">Нет</span>';
          } else if (header === 'anomaly_score') {
            formattedValue = 'N/A';
          } else {
            formattedValue = '<span class="text-muted">NULL</span>';
          }
        } else if (typeof value === 'number') {
          // Обычное отображение для всех числовых значений без бейджей
          formattedValue = value.toFixed(4).replace(/\.?0+$/, '');
        } else if (typeof value === 'boolean') {
          formattedValue = value ?
            '<span class="badge bg-success">TRUE</span>' :
            '<span class="badge bg-danger">FALSE</span>';
        } else if (header === 'is_sample') {
          formattedValue = value ?
            '<span class="badge bg-success">В выборке</span>' :
            '<span class="badge bg-secondary">Нет</span>';
        } else {
          formattedValue = String(value);
        }

        // Ячейки не нужно специально стилизовать, так как заголовки уже стилизованы
        tableHtml += `<td>${formattedValue}</td>`;
      });

      tableHtml += '</tr>';
    }

    // Добавляем сообщение, что показаны не все данные
    if (preprocessedData.length > maxRows) {
      tableHtml += `
        <tr>
          <td colspan="${orderedColumns.length}" class="text-center text-muted">
            <em>Показаны первые ${maxRows} из ${preprocessedData.length} записей</em>
          </td>
        </tr>
      `;
    }

    // Закрываем таблицу
    tableHtml += `
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Вставляем HTML в соответствующие контейнеры
    preprocessedStatsContainer.innerHTML = statsHtml;
    preprocessedResultsContainer.innerHTML = tableHtml;

  } catch (error) {
    console.error('Ошибка при отображении предобработанных данных:', error);
    document.getElementById('preprocessedResults').innerHTML = `
      <div class="alert alert-danger">
        <div class="d-flex align-items-center">
          <span class="material-icons me-2">error</span>
          <span>Ошибка при отображении предобработанных данных: ${error.message}</span>
        </div>
      </div>
    `;
  }
}

/**
 * Инициализирует обработчики событий
 */
function initEventHandlers() {
  // Обработчик загрузки файла
  document.getElementById('fileInput').addEventListener('change', handleFileUpload);

  // Обработчики экспорта
  document.getElementById('exportCsvBtn').addEventListener('click', () => {
    exportData('csv');
  });

  document.getElementById('exportExcelBtn').addEventListener('click', () => {
    exportData('xlsx');
  });

  // Обработчик генерации выборки
  document.getElementById('generateBtn').addEventListener('click', generateSampleData);

  // Обработчик переключения вкладок
  document.getElementById('results-tab').addEventListener('click', () => {
    displayResults();
  });

  // Обработчик для вкладки подробностей (бывшие предобработанные данные)
  document.getElementById('details-tab').addEventListener('click', () => {
    displayPreprocessedData();
  });

  // ... existing code ...
}

/**
 * Обрабатывает результат выборки
 */
function handleSampleResult(sampleResult) {
  try {
    if (!sampleResult || !sampleResult.data) {
      console.error('Некорректный формат результата выборки');
      return;
    }

    // Обновляем данные в dataManager
    updateDataManagerWithResults(sampleResult);

    // Обновляем глобальные данные
    window.data = sampleResult.data;

    // Подготавливаем и отображаем выборку
    prepareSampleData();
    displayResults();

    // Показываем вкладку "Подробности" и передаем туда данные только если 
    // использовался метод машинного обучения
    const isMLMethod = sampleResult.method === 'isolationForest';
    toggleDetailsTab(isMLMethod);

    // Переключаемся на вкладку с результатами
    document.getElementById('results-tab').click();

    // Активируем кнопки экспорта
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportExcelBtn = document.getElementById('exportExcelBtn');

    if (exportCsvBtn) {
      exportCsvBtn.disabled = false;
      exportCsvBtn.classList.add('btn-active');
    }

    if (exportExcelBtn && xlsxLoaded) {
      exportExcelBtn.disabled = false;
      exportExcelBtn.classList.add('btn-active');
    }

  } catch (e) {
    console.error('Ошибка при обработке результата выборки:', e);
    showError('Ошибка при обработке результата выборки: ' + e.message);
  }
}

/**
 * Обновляет dataManager с результатами выборки
 * @param {Object} sampleResult - результат выборки
 */
function updateDataManagerWithResults(sampleResult) {
  // Проверяем и удаляем служебное поле _record_id перед экспортом
  const cleanedData = sampleResult.data.map(item => {
    const cleanItem = { ...item };
    if ('_record_id' in cleanItem) {
      delete cleanItem._record_id;
    }
    return cleanItem;
  });

  // Сохраняем результаты выборки в dataManager
  if (window.dataManager) {
    window.dataManager.setSamplingResult(cleanedData, {
      method: sampleResult.method,
      parameters: sampleResult.parameters,
      result: {
        sampleSize: cleanedData.filter(item => item.is_sample).length,
        totalSize: cleanedData.length
      }
    });
  } else {
    // Обратная совместимость
    window.data = cleanedData;
  }

  // Обновляем предобработанные данные только для методов машинного обучения
  if (sampleResult.method === 'isolationForest') {
    displayPreprocessedData();
  }
}

/**
 * Подготавливает данные выборки для отображения
 */
function prepareSampleData() {
  // Подготовка данных для отображения может быть реализована здесь
  // В текущей версии эта функция пустая, так как обработка данных 
  // уже происходит в других функциях
}