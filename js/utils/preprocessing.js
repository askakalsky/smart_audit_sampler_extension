/**
 * Модуль препроцессинга данных для расширения Chrome Statistical Sampler
 * Содержит функции для преобразования данных перед применением алгоритмов
 * машинного обучения, в частности Isolation Forest
 */

// Глобальный объект для всех функций препроцессинга
(function (window) {
    // Настройка логирования
    const logger = {
        debug: (message) => console.debug(new Date().toISOString() + ' - DEBUG - ' + message),
        info: (message) => console.info(new Date().toISOString() + ' - INFO - ' + message),
        warn: (message) => console.warn(new Date().toISOString() + ' - WARN - ' + message),
        error: (message) => console.error(new Date().toISOString() + ' - ERROR - ' + message),
        exception: (message) => console.error(new Date().toISOString() + ' - ERROR - ' + message)
    };

    /**
     * Определяет типы колонок в данных (числовые или категориальные)
     * Числовая колонка также может быть категориальной, если содержит
     * небольшое количество уникальных значений.
     * 
     * @param {Array} data - Массив объектов данных
     * @param {Object} options - Параметры определения типов
     * @param {number} [options.threshold=0.8] - Пороговый процент числовых значений для определения колонки как числовой
     * @param {number} [options.sampleSize=100] - Размер выборки для анализа
     * @param {number} [options.maxUniqueValues=20] - Максимальное число уникальных значений для категориальных признаков
     * @returns {Object} Объект с массивами имен числовых и категориальных признаков
     */
    window.detectColumnTypes = function (data, options = {}) {
        if (!data || data.length === 0) {
            return { numerical: [], categorical: [] };
        }

        const { threshold = 0.8, sampleSize = 100, maxUniqueValues = 20 } = options;

        // Пропускаем служебные поля
        const ignoreFields = ['is_sample', 'anomaly_score', '_record_id'];

        // Получаем список всех полей из первого элемента
        const columns = Object.keys(data[0]).filter(col => !ignoreFields.includes(col));

        const numericColumns = [];
        const categoricalColumns = [];
        const actualSampleSize = Math.min(sampleSize, data.length);

        columns.forEach(column => {
            // Счетчики для определения типа
            let numericCount = 0;
            const uniqueValues = new Set();

            // Проверяем тип данных на выборке
            for (let i = 0; i < actualSampleSize; i++) {
                const value = data[i][column];

                // Добавляем значение в множество уникальных значений
                if (value !== undefined && value !== null) {
                    uniqueValues.add(String(value).trim());
                }

                // Проверяем, является ли значение числовым
                if (typeof value === 'number' ||
                    (typeof value === 'string' && !isNaN(value) && value.trim() !== '')) {
                    numericCount++;
                }
            }

            // Если более threshold% значений числовые, считаем колонку числовой
            const isNumeric = numericCount / actualSampleSize > threshold;

            // Если количество уникальных значений меньше maxUniqueValues,
            // то считаем признак категориальным, независимо от его типа
            const isCategorical = uniqueValues.size <= maxUniqueValues && uniqueValues.size > 1;

            // Добавляем колонку в соответствующие списки
            if (isNumeric) {
                numericColumns.push(column);
            }

            if (isCategorical) {
                categoricalColumns.push(column);
            } else if (!isNumeric) {
                // Если признак не числовой и не категориальный, 
                // считаем его текстовым и добавляем в категориальные
                categoricalColumns.push(column);
            }
        });

        return {
            numerical: numericColumns,
            categorical: categoricalColumns
        };
    };

    /**
     * Вычисляет перекос (skewness) для массива значений
     * Точная реализация формулы асимметрии для выборки, соответствующая scipy.stats.skew
     * 
     * @param {Array<number>} values - Массив числовых значений
     * @returns {number} Значение перекоса
     */
    function calculateSkewness(values) {
        if (!values || values.length < 3) return 0; // Нужно минимум 3 значения для расчета перекоса

        // Фильтруем null и undefined значения
        const filteredValues = values.filter(val => val !== null && val !== undefined);
        if (filteredValues.length < 3) return 0;

        // Вычисляем среднее значение
        const mean = filteredValues.reduce((sum, val) => sum + val, 0) / filteredValues.length;

        // Вычисляем второй момент (дисперсия) и третий момент
        let m2 = 0; // сумма квадратов отклонений
        let m3 = 0; // сумма кубов отклонений

        filteredValues.forEach(val => {
            const diff = val - mean;
            m2 += diff * diff;
            m3 += diff * diff * diff;
        });

        // Расчет корректированной выборочной дисперсии (несмещенная оценка)
        const variance = m2 / (filteredValues.length - 1);

        if (variance === 0) return 0; // Избегаем деления на ноль

        // Расчет стандартного отклонения
        const stdDev = Math.sqrt(variance);

        // Вычисляем скорректированный коэффициент асимметрии, как в scipy.stats.skew
        // Формула: g1 = (m3/n) / (m2/n)^(3/2) * корректирующий множитель
        // Корректирующий множитель = sqrt(n*(n-1))/(n-2)
        const n = filteredValues.length;
        const g1 = (m3 / n) / Math.pow(m2 / n, 1.5);
        const correctionFactor = Math.sqrt(n * (n - 1)) / (n - 2);

        const skewness = g1 * correctionFactor;

        return skewness;
    }

    /**
     * Применяет логарифмическое преобразование log1p (ln(1+x)) к значению
     * Для x <= 0 значение остается без изменения
     * 
     * @param {number} x - Входное значение
     * @returns {number} Преобразованное значение
     */
    function log1p(x) {
        return x > 0 ? Math.log(1 + x) : x;
    }

    /**
     * Класс для стандартизации данных (StandardScaler)
     * Преобразует данные к распределению со средним 0 и стандартным отклонением 1
     */
    class StandardScaler {
        constructor() {
            this.means = {};
            this.stds = {};
        }

        /**
         * Вычисляет параметры масштабирования и преобразует данные
         * 
         * @param {Array<Object>} data - Исходные данные (массив объектов)
         * @param {Array<string>} columns - Колонки для масштабирования
         * @returns {Array<Object>} Масштабированные данные
         */
        fitTransform(data, columns) {
            if (!data || data.length === 0 || !columns || columns.length === 0) {
                return data;
            }

            // Вычисляем среднее и стандартное отклонение для каждой колонки
            columns.forEach(col => {
                const values = data.map(item => typeof item[col] === 'number' ? item[col] : parseFloat(item[col])).filter(val => !isNaN(val));

                // Среднее значение
                this.means[col] = values.reduce((sum, val) => sum + val, 0) / values.length;

                // Стандартное отклонение
                const squaredDiffs = values.map(val => Math.pow(val - this.means[col], 2));
                this.stds[col] = Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length);

                // Если стандартное отклонение близко к нулю, устанавливаем его в 1 для избежания деления на ноль
                if (this.stds[col] < 1e-10) this.stds[col] = 1;
            });

            // Создаем копию данных и применяем масштабирование
            const scaledData = JSON.parse(JSON.stringify(data));

            scaledData.forEach(item => {
                columns.forEach(col => {
                    if (typeof item[col] === 'number' || !isNaN(parseFloat(item[col]))) {
                        const value = typeof item[col] === 'number' ? item[col] : parseFloat(item[col]);
                        item[col] = (value - this.means[col]) / this.stds[col];
                    }
                });
            });

            return scaledData;
        }

        /**
         * Преобразует данные с использованием сохраненных параметров
         * 
         * @param {Array<Object>} data - Исходные данные (массив объектов)
         * @param {Array<string>} columns - Колонки для масштабирования
         * @returns {Array<Object>} Масштабированные данные
         */
        transform(data, columns) {
            if (!data || data.length === 0 || !columns || columns.length === 0) {
                return data;
            }

            // Создаем копию данных и применяем масштабирование
            const scaledData = JSON.parse(JSON.stringify(data));

            scaledData.forEach(item => {
                columns.forEach(col => {
                    if (this.means[col] !== undefined && this.stds[col] !== undefined) {
                        if (typeof item[col] === 'number' || !isNaN(parseFloat(item[col]))) {
                            const value = typeof item[col] === 'number' ? item[col] : parseFloat(item[col]);
                            item[col] = (value - this.means[col]) / this.stds[col];
                        }
                    }
                });
            });

            return scaledData;
        }
    }

    /**
     * Класс для масштабирования данных в диапазон [0, 1] (MinMaxScaler)
     */
    class MinMaxScaler {
        constructor() {
            this.mins = {};
            this.maxs = {};
        }

        /**
         * Вычисляет параметры масштабирования и преобразует данные
         * 
         * @param {Array<Object>} data - Исходные данные (массив объектов)
         * @param {Array<string>} columns - Колонки для масштабирования
         * @returns {Array<Object>} Масштабированные данные
         */
        fitTransform(data, columns) {
            if (!data || data.length === 0 || !columns || columns.length === 0) {
                return data;
            }

            // Вычисляем минимальное и максимальное значение для каждой колонки
            columns.forEach(col => {
                const values = data.map(item => typeof item[col] === 'number' ? item[col] : parseFloat(item[col])).filter(val => !isNaN(val));

                this.mins[col] = Math.min(...values);
                this.maxs[col] = Math.max(...values);

                // Если диапазон слишком мал, устанавливаем его ненулевым для избежания деления на ноль
                if (Math.abs(this.maxs[col] - this.mins[col]) < 1e-10) {
                    this.maxs[col] = this.mins[col] + 1;
                }
            });

            // Создаем копию данных и применяем масштабирование
            const scaledData = JSON.parse(JSON.stringify(data));

            scaledData.forEach(item => {
                columns.forEach(col => {
                    if (typeof item[col] === 'number' || !isNaN(parseFloat(item[col]))) {
                        const value = typeof item[col] === 'number' ? item[col] : parseFloat(item[col]);
                        item[col] = (value - this.mins[col]) / (this.maxs[col] - this.mins[col]);
                    }
                });
            });

            return scaledData;
        }

        /**
         * Преобразует данные с использованием сохраненных параметров
         * 
         * @param {Array<Object>} data - Исходные данные (массив объектов)
         * @param {Array<string>} columns - Колонки для масштабирования
         * @returns {Array<Object>} Масштабированные данные
         */
        transform(data, columns) {
            if (!data || data.length === 0 || !columns || columns.length === 0) {
                return data;
            }

            // Создаем копию данных и применяем масштабирование
            const scaledData = JSON.parse(JSON.stringify(data));

            scaledData.forEach(item => {
                columns.forEach(col => {
                    if (this.mins[col] !== undefined && this.maxs[col] !== undefined) {
                        if (typeof item[col] === 'number' || !isNaN(parseFloat(item[col]))) {
                            const value = typeof item[col] === 'number' ? item[col] : parseFloat(item[col]);
                            item[col] = (value - this.mins[col]) / (this.maxs[col] - this.mins[col]);
                        }
                    }
                });
            });

            return scaledData;
        }
    }

    /**
     * Выполняет one-hot encoding для категориальных признаков
     * Аналог функции pd.get_dummies из pandas
     * 
     * @param {Array<Object>} data - Исходные данные (массив объектов)
     * @param {Array<string>} categoricalColumns - Категориальные колонки для кодирования
     * @returns {Object} Объект с преобразованными данными и новыми колонками
     */
    function oneHotEncoding(data, categoricalColumns) {
        if (!data || data.length === 0 || !categoricalColumns || categoricalColumns.length === 0) {
            return { data: data, newColumns: [] };
        }

        // Создаем копию данных
        const encodedData = JSON.parse(JSON.stringify(data));
        const newColumns = [];

        // Для каждой категориальной колонки создаем отдельные колонки для каждого уникального значения
        categoricalColumns.forEach(column => {
            // Получаем все уникальные значения в колонке
            const uniqueValues = new Set();
            data.forEach(item => {
                if (item[column] !== undefined && item[column] !== null) {
                    uniqueValues.add(String(item[column]).trim());
                }
            });

            // Создаем новые колонки для каждого уникального значения
            uniqueValues.forEach(value => {
                // Форматируем имя колонки аналогично pandas: column_value
                const newColumnName = `${column}_${value}`;
                newColumns.push(newColumnName);

                // Проставляем 1 или 0 для каждого элемента данных (соответствие pandas get_dummies)
                encodedData.forEach(item => {
                    const itemValue = item[column] !== undefined && item[column] !== null ? String(item[column]).trim() : '';
                    item[newColumnName] = itemValue === value ? 1 : 0;
                });
            });
        });

        // Убеждаемся, что все новые колонки содержат числовые значения (int) а не булевы
        encodedData.forEach(item => {
            newColumns.forEach(col => {
                if (typeof item[col] === 'boolean') {
                    item[col] = item[col] ? 1 : 0;
                }
            });
        });

        return { data: encodedData, newColumns: newColumns };
    }

    /**
     * Основная функция предварительной обработки данных для машинного обучения
     * Аналог функции preprocess_data из Python-кода
     * 
     * @param {Array<Object>} data - Исходные данные (массив объектов)
     * @param {Array<string>} numericalColumns - Числовые колонки для масштабирования
     * @param {Array<string>} categoricalColumns - Категориальные колонки для кодирования
     * @param {Object} options - Дополнительные параметры
     * @param {number} [options.sampleFraction=1.0] - Доля выборки от общего размера данных
     * @param {number} [options.skewThreshold=0.75] - Порог перекоса для логарифмического преобразования
     * @param {number} [options.randomSeed] - Зерно для воспроизводимости при выборке
     * @returns {Object} Объект с преобразованными данными и описанием метода
     */
    window.preprocessData = function (data, numericalColumns, categoricalColumns, options = {}) {
        try {
            const {
                sampleFraction = 1.0,
                skewThreshold = 0.75,
                randomSeed
            } = options;

            if (!data || data.length === 0) {
                return {
                    data: [],
                    description: "Ошибка: Переданы пустые данные"
                };
            }

            if (!numericalColumns && !categoricalColumns) {
                return {
                    data: data,
                    description: "Ошибка: Не указаны колонки для обработки"
                };
            }

            logger.info("Начало предварительной обработки данных");

            // Создаем копию данных
            let processedData = JSON.parse(JSON.stringify(data));
            let methodDescription = "";

            // Применяем выборку, если необходимо
            if (sampleFraction < 1.0) {
                const originalSize = processedData.length;
                const sampleSize = Math.round(originalSize * sampleFraction);

                // Создаем псевдослучайный генератор с заданным зерном
                const random = randomSeed ? createSeededRandom(randomSeed) : Math.random;

                // Перемешиваем данные и берем первые sampleSize элементов
                processedData = processedData
                    .map(item => ({ item, random: random() }))
                    .sort((a, b) => a.random - b.random)
                    .slice(0, sampleSize)
                    .map(({ item }) => item);

                methodDescription += `Метод выборки: Случайная выборка.\n`;
                methodDescription += `Общий размер популяции: ${originalSize}.\n`;
                methodDescription += `Размер выборки: ${processedData.length}.\n`;
                methodDescription += `Доля выборки: ${sampleFraction}.\n`;
                methodDescription += `Дата и время выборки: ${new Date().toISOString()}.\n`;
                methodDescription += `Случайное зерно: ${randomSeed || 'не указано'}.\n`;

                logger.info(`Выборка ${sampleFraction * 100}% данных выполнена.`);
            }

            // Сохраняем начальный набор колонок перед one-hot encoding
            const initialColumns = Object.keys(processedData[0]);
            const transformedColumns = {};

            // Массив для отслеживания всех сгенерированных колонок
            let allGeneratedColumns = [];

            // Обработка категориальных колонок с помощью one-hot encoding
            if (categoricalColumns && categoricalColumns.length > 0) {
                const encodingResult = oneHotEncoding(processedData, categoricalColumns);
                processedData = encodingResult.data;
                const newColumns = encodingResult.newColumns;
                allGeneratedColumns = [...allGeneratedColumns, ...newColumns];

                methodDescription += `One-hot encoding применен к категориальным колонкам: ${categoricalColumns.join(', ')}.\n`;
                methodDescription += `Сгенерированные колонки: ${newColumns.join(', ')}.\n`;
                methodDescription += `Дата и время преобразования: ${new Date().toISOString()}.\n`;

                logger.info(`One-hot encoding применен к категориальным колонкам: ${categoricalColumns.join(', ')}`);

                // Сохраняем информацию о преобразованных колонках
                newColumns.forEach(col => {
                    transformedColumns[col] = 'one_hot';
                });

                // Преобразуем булевы значения в целые числа (0, 1), как в Python-коде
                newColumns.forEach(col => {
                    processedData.forEach(item => {
                        if (typeof item[col] === 'boolean') {
                            item[col] = item[col] ? 1 : 0;
                        }
                    });
                });
            }

            // Обрабатываем числовые колонки
            if (numericalColumns && numericalColumns.length > 0) {
                const skewedFeatures = [];
                const normalFeatures = [];

                for (const col of numericalColumns) {
                    // Проверяем, существует ли колонка в данных
                    if (processedData.length > 0 && processedData[0][col] !== undefined) {
                        // Извлекаем числовые значения колонки
                        const columnValues = processedData
                            .map(item => typeof item[col] === 'number' ? item[col] : parseFloat(item[col]))
                            .filter(val => !isNaN(val));

                        // Вычисляем перекос распределения
                        const skewness = calculateSkewness(columnValues);
                        logger.info(`Перекос для ${col}: ${skewness}`);

                        if (Math.abs(skewness) > skewThreshold) {
                            // Применяем логарифмическое преобразование к сильно перекошенным данным,
                            // но только к положительным значениям (как в Python-коде)
                            processedData.forEach(item => {
                                if (typeof item[col] === 'number' || !isNaN(parseFloat(item[col]))) {
                                    const value = typeof item[col] === 'number' ? item[col] : parseFloat(item[col]);
                                    item[col] = log1p(value); // log1p применяется только к значениям > 0
                                }
                            });

                            skewedFeatures.push(col);
                            transformedColumns[col] = 'log_transform_minmax';
                            methodDescription += `Логарифмическое преобразование применено к перекошенной колонке: ${col}.\n`;
                            methodDescription += `Перекос: ${skewness}.\n`;
                            methodDescription += `Порог преобразования: ${skewThreshold}.\n`;
                            methodDescription += `Дата и время преобразования: ${new Date().toISOString()}.\n`;
                        } else {
                            // Стандартизируем нормально распределенные данные
                            normalFeatures.push(col);
                            transformedColumns[col] = 'standard_scale';
                            methodDescription += `Колонка рассматривается как нормально распределенная: ${col}.\n`;
                            methodDescription += `Перекос: ${skewness}.\n`;
                            methodDescription += `Преобразование не требуется.\n`;
                        }
                    }
                }

                // Применяем Min-Max масштабирование для логарифмически преобразованных (перекошенных) колонок
                // Это соответствует Python-коду, где используется MinMaxScaler для перекошенных данных
                if (skewedFeatures.length > 0) {
                    const minMaxScaler = new MinMaxScaler();
                    processedData = minMaxScaler.fitTransform(processedData, skewedFeatures);

                    methodDescription += `Min-Max масштабирование применено к перекошенным признакам: ${skewedFeatures.join(', ')}.\n`;
                    methodDescription += `Тип масштабирования: MinMaxScaler.\n`;
                    methodDescription += `Дата и время масштабирования: ${new Date().toISOString()}.\n`;

                    logger.info(`Min-Max масштабирование применено к перекошенным признакам: ${skewedFeatures.join(', ')}`);
                }

                // Применяем стандартное масштабирование к нормально распределенным колонкам
                // Это соответствует Python-коду, где используется StandardScaler для нормальных данных
                if (normalFeatures.length > 0) {
                    const standardScaler = new StandardScaler();
                    processedData = standardScaler.fitTransform(processedData, normalFeatures);

                    methodDescription += `Стандартное масштабирование применено к нормальным признакам: ${normalFeatures.join(', ')}.\n`;
                    methodDescription += `Тип масштабирования: StandardScaler.\n`;
                    methodDescription += `Дата и время масштабирования: ${new Date().toISOString()}.\n`;

                    logger.info(`Стандартное масштабирование применено к нормально распределенным признакам: ${normalFeatures.join(', ')}`);
                }
            }

            // Объединяем числовые колонки и новые категориальные колонки для итогового набора признаков
            // Это точно соответствует Python-коду, где available_features = numerical_columns + new_categorical_columns
            const availableFeatures = [...numericalColumns, ...allGeneratedColumns];

            // Фильтруем массив данных, чтобы включать только доступные признаки
            // Это соответствует Python-коду: df_processed = df_processed[available_features]
            const filteredData = processedData.map(item => {
                const filteredItem = {};
                availableFeatures.forEach(feature => {
                    if (item[feature] !== undefined) {
                        filteredItem[feature] = item[feature];
                    }
                });
                return filteredItem;
            });

            // Добавляем итоговое описание преобразований
            methodDescription += `\nИтоговое описание преобразований:\n`;
            for (const col in transformedColumns) {
                const transformType = transformedColumns[col];
                let description = '';

                switch (transformType) {
                    case 'one_hot':
                        description = 'One-hot кодирование';
                        break;
                    case 'log_transform_minmax':
                        description = 'Логарифмическое преобразование + Min-Max масштабирование [0,1]';
                        break;
                    case 'standard_scale':
                        description = 'Стандартизация (mean=0, std=1)';
                        break;
                    default:
                        description = 'Без преобразования';
                }

                methodDescription += `- ${col}: ${description}\n`;
            }

            methodDescription += `\nДата и время завершения обработки: ${new Date().toISOString()}.\n`;

            // Логируем описание метода для справки
            logger.info(`Описание метода предобработки:\n${methodDescription}`);

            // Возвращаем обработанные данные и описание метода
            return {
                data: filteredData, // Используем отфильтрованные данные, как в Python-коде
                description: methodDescription,
                transformations: transformedColumns,
                features: availableFeatures // Добавляем список доступных признаков, как в Python-коде
            };

        } catch (error) {
            // Логируем исключение и возвращаем ошибку
            logger.exception(`Ошибка в preprocessData: ${error.message}`);
            return {
                data: data,
                description: `Ошибка предобработки данных: ${error.message}`
            };
        }
    };

    /**
     * Создает псевдослучайный генератор с заданным начальным значением
     * 
     * @param {number} seed - Начальное значение генератора
     * @returns {Function} Функция, возвращающая псевдослучайное число в диапазоне [0, 1)
     */
    function createSeededRandom(seed) {
        let state = Math.abs(seed) || 1;

        return function () {
            const x = Math.sin(state++) * 10000;
            return x - Math.floor(x);
        };
    }

    /**
     * Выполняет преобразование категориальных признаков в числовые с сохранением оригинальных данных
     * 
     * @param {Array<Object>} data Массив объектов данных
     * @param {Array<string>} numericalFeatures Массив имен числовых признаков
     * @param {Array<string>} categoricalFeatures Массив имен категориальных признаков
     * @returns {Object} Объект с преобразованными данными и описанием
     */
    window.preprocessCategoricalFeatures = function (data, numericalFeatures, categoricalFeatures) {
        try {
            console.log("Начало предобработки категориальных признаков:", {
                dataSize: data.length,
                numericalFeatures,
                categoricalFeatures
            });

            // Создаем глубокую копию данных для обработки
            const processedData = JSON.parse(JSON.stringify(data));
            let description = [];
            let transformedFeatures = [];

            // Применяем MinMaxScaler к числовым признакам
            if (numericalFeatures.length > 0) {
                // Создаем экземпляр нормализатора
                const scaler = new MinMaxScaler();

                // Для каждого числового признака создаем новую колонку с префиксом "_"
                numericalFeatures.forEach(feature => {
                    const transformedFeature = `_${feature}`;
                    transformedFeatures.push(transformedFeature);

                    // Извлекаем значения для нормализации и находим мин/макс
                    const values = processedData.map(item => item[feature]).filter(val =>
                        val !== null && val !== undefined && !isNaN(val)
                    );

                    if (values.length > 0) {
                        const min = Math.min(...values);
                        const max = Math.max(...values);

                        // Нормализуем значения в диапазоне [0, 1]
                        processedData.forEach(item => {
                            const originalValue = item[feature];
                            if (originalValue !== null && originalValue !== undefined && !isNaN(originalValue)) {
                                if (max !== min) {
                                    item[transformedFeature] = (originalValue - min) / (max - min);
                                } else {
                                    item[transformedFeature] = 0.5; // Если все значения одинаковые
                                }
                            } else {
                                item[transformedFeature] = 0; // Значение по умолчанию для missing values
                            }
                        });

                        description.push(`Числовой признак "${feature}" нормализован методом Min-Max в диапазоне [0, 1] как "${transformedFeature}"`);
                    } else {
                        // Если нет валидных значений, просто копируем
                        processedData.forEach(item => {
                            item[transformedFeature] = item[feature];
                        });
                        description.push(`Числовой признак "${feature}" скопирован как "${transformedFeature}" (нормализация не применялась из-за отсутствия валидных значений)`);
                    }
                });
            }

            // Применяем One-Hot-Encoding к категориальным признакам
            if (categoricalFeatures.length > 0) {
                const uniqueValues = {};

                // Сначала определяем все уникальные значения каждого категориального признака
                categoricalFeatures.forEach(feature => {
                    uniqueValues[feature] = new Set();

                    processedData.forEach(item => {
                        if (item[feature] !== undefined && item[feature] !== null) {
                            uniqueValues[feature].add(String(item[feature]).trim());
                        }
                    });
                });

                // Затем создаем бинарные признаки для каждого уникального значения
                categoricalFeatures.forEach(feature => {
                    const values = Array.from(uniqueValues[feature]);
                    const newColumns = [];

                    values.forEach(value => {
                        // Создаем новую колонку с префиксом "_"
                        const newColumnName = `_${feature}_${value}`;
                        newColumns.push(newColumnName);
                        transformedFeatures.push(newColumnName);

                        // Заполняем бинарными значениями
                        processedData.forEach(item => {
                            const itemValue = item[feature] !== undefined && item[feature] !== null ?
                                String(item[feature]).trim() : '';
                            item[newColumnName] = itemValue === value ? 1 : 0;
                        });
                    });

                    description.push(`Категориальный признак "${feature}" преобразован в ${newColumns.length} бинарных признаков: ${newColumns.join(', ')}`);
                });
            }

            console.log("Предобработка данных завершена:", {
                originalFeatures: [...numericalFeatures, ...categoricalFeatures],
                transformedFeatures
            });

            return {
                data: processedData,
                description: description.join('\n'),
                features: transformedFeatures
            };
        } catch (error) {
            console.error("Ошибка при предобработке категориальных признаков:", error);

            return {
                data: data,
                description: `Ошибка при предобработке: ${error.message}`,
                features: [...numericalFeatures, ...categoricalFeatures]
            };
        }
    };

})(window); 