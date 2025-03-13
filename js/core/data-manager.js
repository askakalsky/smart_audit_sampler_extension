/**
 * DataManager - модуль для управления данными в расширении
 * Предоставляет методы для работы с данными, связанными с выборкой и машинным обучением
 */

class DataManager {
    constructor() {
        this.state = {
            // Исходные данные (популяция)
            originalData: [],

            // Данные выборки (подмножество из originalData с флагом is_sample)
            sampleData: [],

            // Преобразованная популяция (для анализа и ML)
            transformedData: [],

            // Метаданные о методе выборки
            samplingMetadata: {
                method: null,      // Метод выборки: random, systematic, stratified, mus
                parameters: {},    // Параметры выборки (размер, seed и т.д.)
                timestamp: null,   // Время формирования выборки
                result: null       // Статистика результата
            },

            // Метаданные о ML преобразованиях
            mlMetadata: {
                transformations: [], // Список примененных преобразований
                models: [],          // Информация о примененных моделях
                features: []         // Информация о признаках
            }
        };

        this.eventListeners = {};

        // Сразу пытаемся загрузить данные из хранилища
        this._loadFromStorage();
    }

    /**
     * Получает все данные текущего состояния
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Получает исходные данные популяции
     */
    getOriginalData() {
        return this.state.originalData;
    }

    /**
     * Получает данные выборки
     */
    getSampleData() {
        return this.state.sampleData;
    }

    /**
     * Получает преобразованные данные
     */
    getTransformedData() {
        return this.state.transformedData;
    }

    /**
     * Получает метаданные о выборке
     */
    getSamplingMetadata() {
        return { ...this.state.samplingMetadata };
    }

    /**
     * Устанавливает исходные данные популяции и очищает другие связанные данные
     * @param {Array} data - Массив исходных данных
     */
    setOriginalData(data) {
        if (!Array.isArray(data)) {
            console.warn('DataManager.setOriginalData: data не является массивом, преобразуем в массив');
            data = data ? [data] : [];
        }

        // Очищаем существующие данные, связанные с выборкой
        this.state.originalData = data;
        this.state.sampleData = [];
        this.state.transformedData = [];
        this.state.samplingMetadata = {
            method: null,
            parameters: {},
            timestamp: null,
            result: null
        };

        // Совместимость с существующим кодом
        window.data = data;

        this._triggerEvent('data-changed', this.state);
        this._triggerEvent('original-data-changed', data);
        this._saveToStorage();
    }

    /**
     * Устанавливает результаты выборки
     * @param {Array} data - Полный набор данных с пометками выборки
     * @param {Object} metadata - Метаданные о методе выборки
     */
    setSamplingResult(data, metadata = {}) {
        if (!Array.isArray(data)) {
            console.warn('DataManager.setSamplingResult: data не является массивом, преобразуем в массив');
            data = data ? [data] : [];
        }

        // Обновляем оригинальные данные и выделяем выборку
        this.state.originalData = data;
        this.state.sampleData = data.filter(item => item.is_sample === true);

        // Обновляем метаданные выборки
        this.state.samplingMetadata = {
            ...this.state.samplingMetadata,
            ...metadata,
            timestamp: new Date().toISOString()
        };

        // Совместимость с существующим кодом
        window.data = data;

        this._triggerEvent('data-changed', this.state);
        this._triggerEvent('sample-created', {
            data: this.state.sampleData,
            metadata: this.state.samplingMetadata
        });
        this._saveToStorage();
    }

    /**
     * Устанавливает преобразованные данные (для ML)
     * @param {Array} data - Преобразованные данные
     * @param {Object} transformationInfo - Информация о преобразованиях
     */
    setTransformedData(data, transformationInfo = {}) {
        if (!Array.isArray(data)) {
            console.warn('DataManager.setTransformedData: data не является массивом, преобразуем в массив');
            data = data ? [data] : [];
        }

        this.state.transformedData = data;

        // Добавляем информацию о преобразовании
        if (transformationInfo) {
            this.state.mlMetadata.transformations.push({
                ...transformationInfo,
                timestamp: new Date().toISOString()
            });
        }

        this._triggerEvent('data-changed', this.state);
        this._triggerEvent('transformed-data-changed', {
            data: this.state.transformedData,
            metadata: this.state.mlMetadata
        });
        this._saveToStorage();
    }

    /**
     * Добавляет информацию о модели ML
     * @param {Object} modelInfo - Информация о модели
     */
    addModelInfo(modelInfo) {
        this.state.mlMetadata.models.push({
            ...modelInfo,
            timestamp: new Date().toISOString()
        });

        this._triggerEvent('ml-metadata-changed', this.state.mlMetadata);
        this._saveToStorage();
    }

    /**
     * Очищает все данные
     */
    clearAllData() {
        this.state = {
            originalData: [],
            sampleData: [],
            transformedData: [],
            samplingMetadata: {
                method: null,
                parameters: {},
                timestamp: null,
                result: null
            },
            mlMetadata: {
                transformations: [],
                models: [],
                features: []
            }
        };

        // Совместимость с существующим кодом
        window.data = [];

        this._triggerEvent('data-changed', this.state);
        localStorage.removeItem('samplerData');
        console.log('Все данные очищены');
    }

    /**
     * Регистрирует обработчик события
     * @param {string} eventName - Имя события
     * @param {Function} callback - Функция обработчика
     */
    addEventListener(eventName, callback) {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);

        return this; // Для цепочки вызовов
    }

    /**
     * Удаляет обработчик события
     * @param {string} eventName - Имя события
     * @param {Function} callback - Функция обработчика для удаления
     */
    removeEventListener(eventName, callback) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName] = this.eventListeners[eventName]
                .filter(listener => listener !== callback);
        }

        return this; // Для цепочки вызовов
    }

    /**
     * Запускает событие с указанными данными
     * @param {string} eventName - Имя события
     * @param {any} data - Данные для передачи в обработчики
     * @private
     */
    _triggerEvent(eventName, data) {
        try {
            if (this.eventListeners[eventName]) {
                this.eventListeners[eventName].forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Ошибка в обработчике события ${eventName}:`, error);
                    }
                });
            }
        } catch (error) {
            console.error(`Ошибка при вызове события ${eventName}:`, error);
        }
    }

    /**
     * Сохраняет данные в локальное хранилище
     * @private
     */
    _saveToStorage() {
        try {
            // Сохраняем только необходимые данные, чтобы не превысить лимит хранилища
            const dataToSave = {
                originalData: this.state.originalData,
                samplingMetadata: this.state.samplingMetadata,
                timestamp: new Date().toISOString()
            };

            localStorage.setItem('samplerData', JSON.stringify(dataToSave));
            console.log('Данные успешно сохранены в localStorage');

            // Сохраняем крупные наборы данных в chrome.storage если доступно
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({
                    'samplerAdvancedData': {
                        transformedData: this.state.transformedData,
                        mlMetadata: this.state.mlMetadata
                    }
                });
            }

            return true;
        } catch (error) {
            console.error('Ошибка при сохранении данных:', error);
            return false;
        }
    }

    /**
     * Загружает данные из локального хранилища
     * @private
     */
    _loadFromStorage() {
        try {
            // Загружаем основные данные из localStorage
            const storedData = localStorage.getItem('samplerData');
            if (storedData) {
                const parsedData = JSON.parse(storedData);

                if (parsedData.originalData) {
                    this.state.originalData = parsedData.originalData;
                    // Идентифицируем элементы выборки, если они есть
                    this.state.sampleData = parsedData.originalData.filter(item => item.is_sample === true);
                }

                if (parsedData.samplingMetadata) {
                    this.state.samplingMetadata = parsedData.samplingMetadata;
                }

                // Совместимость с существующим кодом
                window.data = this.state.originalData;

                console.log('Данные успешно загружены из localStorage');

                // Загружаем дополнительные данные из chrome.storage если доступно
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get('samplerAdvancedData', (result) => {
                        if (result.samplerAdvancedData) {
                            if (result.samplerAdvancedData.transformedData) {
                                this.state.transformedData = result.samplerAdvancedData.transformedData;
                            }

                            if (result.samplerAdvancedData.mlMetadata) {
                                this.state.mlMetadata = result.samplerAdvancedData.mlMetadata;
                            }

                            this._triggerEvent('data-changed', this.state);
                        }
                    });
                }

                this._triggerEvent('data-changed', this.state);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Ошибка при загрузке данных из хранилища:', error);
            return false;
        }
    }

    // Вспомогательные методы для работы с данными

    /**
     * Получает уникальные значения поля в данных
     * @param {string} fieldName - Имя поля
     * @param {Array} dataSource - Источник данных (по умолчанию originalData)
     * @returns {Array} Массив уникальных значений
     */
    getUniqueValues(fieldName, dataSource = null) {
        const data = dataSource || this.state.originalData;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return [];
        }

        const values = data
            .map(item => item[fieldName])
            .filter(value => value !== undefined && value !== null);

        return [...new Set(values)];
    }

    /**
     * Получает статистические данные для числового поля
     * @param {string} fieldName - Имя поля
     * @param {Array} dataSource - Источник данных (по умолчанию originalData)
     * @returns {Object} Объект статистики (min, max, mean, median, etc.)
     */
    getFieldStatistics(fieldName, dataSource = null) {
        const data = dataSource || this.state.originalData;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return null;
        }

        const values = data
            .map(item => item[fieldName])
            .filter(value => typeof value === 'number' && !isNaN(value));

        if (values.length === 0) {
            return null;
        }

        const sum = values.reduce((acc, val) => acc + val, 0);
        const mean = sum / values.length;
        const sortedValues = [...values].sort((a, b) => a - b);
        const median = sortedValues[Math.floor(sortedValues.length / 2)];

        return {
            count: values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            mean: mean,
            median: median,
            sum: sum
        };
    }
}

// Создаем глобальный экземпляр менеджера данных
window.dataManager = new DataManager(); 