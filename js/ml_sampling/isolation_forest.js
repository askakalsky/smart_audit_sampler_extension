/**
 * Реализация метода выборки на основе алгоритма Isolation Forest 
 * для обнаружения аномалий в данных.
 * 
 * Реализация основана на алгоритме из библиотеки scikit-learn.
 */

// Константы для автоматических гиперпараметров
const DEFAULT_ESTIMATORS = 100;  // Как в sklearn, по умолчанию 100 деревьев
const DEFAULT_MAX_SAMPLES = 256; // Как в sklearn, "auto" = min(256, n_samples)
const DEFAULT_CONTAMINATION = 0.1; // Значение по умолчанию, как в sklearn

/**
 * Выполняет выборку аномальных значений из массива данных с использованием изоляционного леса.
 * 
 * @param {Array} population - Массив объектов, представляющий популяцию для выборки.
 * @param {Object} options - Параметры алгоритма.
 * @param {number} [options.sampleSize] - Количество записей для выбора в выборке (топ-N аномалий).
 *                                       При указании этого параметра contamination игнорируется.
 * @param {number|string} [options.contamination='auto'] - Ожидаемая доля аномалий (0-0.5). 
 *                                                      'auto' для автоматического определения.
 * @param {Array<string>} [options.features] - Массив имен признаков для анализа. 
 *                                           Если пусто, используются все числовые поля.
 * @returns {Object} Объект, содержащий обновленную популяцию, выборку и описание метода.
 */
function createIsolationForestSample(population, options = {}) {
    try {
        console.log("Запуск createIsolationForestSample с параметрами:", {
            populationSize: population?.length,
            options
        });

        // Проверка входных данных
        if (!Array.isArray(population)) {
            throw new TypeError(`Ожидался массив для population, получен ${typeof population}`);
        }

        if (population.length === 0) {
            throw new Error("Невозможно создать выборку из пустой популяции");
        }

        // Инициализация параметров
        const features = options.features || [];
        const contamination = options.contamination !== undefined ? options.contamination : DEFAULT_CONTAMINATION;
        const sampleSize = options.sampleSize !== undefined ? options.sampleSize : null;

        // Определяем режим работы: фиксированный размер выборки или доля аномалий
        const isTopNMode = sampleSize !== null && sampleSize > 0;

        console.log(`Режим работы: ${isTopNMode ? 'top-N аномалий' : 'ожидаемая доля аномалий'}`);

        // Создаем копию популяции, чтобы не изменять исходный массив
        const populationCopy = population.map(item => ({ ...item }));

        // Определяем признаки для анализа
        let featuresToUse;
        if (features.length > 0) {
            featuresToUse = features;
        } else {
            // Если признаки не указаны, используем все числовые поля
            const firstItem = population[0];
            featuresToUse = Object.keys(firstItem).filter(key =>
                typeof firstItem[key] === 'number' &&
                !['is_sample', 'anomaly_score'].includes(key)
            );
        }

        if (featuresToUse.length === 0) {
            throw new Error("Не найдены числовые признаки для анализа");
        }

        // Подготовка данных для модели (2D массив числовых значений)
        const dataPoints = populationCopy.map(item =>
            featuresToUse.map(feature => {
                const value = item[feature];
                // Проверка на NaN и null
                return (value !== undefined && value !== null && !isNaN(value)) ? value : 0;
            })
        );

        console.log(`Подготовлены данные для модели: ${dataPoints.length} записей, ${featuresToUse.length} признаков`);

        // Создаем и обучаем модель изоляционного леса
        // Используем параметры по умолчанию как в sklearn
        const isolationForest = new IsolationForestAdapter({
            nEstimators: DEFAULT_ESTIMATORS,
            maxSamples: Math.min(DEFAULT_MAX_SAMPLES, dataPoints.length),
            contamination: contamination === 'auto' ? DEFAULT_CONTAMINATION : contamination
        });

        console.log(`Начинаем обучение модели с параметрами: nEstimators=${DEFAULT_ESTIMATORS}, contamination=${contamination}`);
        isolationForest.train(dataPoints);
        console.log("Модель успешно обучена");

        // Получение аномальных оценок (1 = наиболее аномальное)
        const anomalyScores = isolationForest.predict(dataPoints);
        console.log(`Получены оценки аномальности для ${anomalyScores.length} записей`);

        // Сортируем индексы по убыванию оценки аномальности
        const indexScorePairs = anomalyScores.map((score, index) => ({ index, score }));
        indexScorePairs.sort((a, b) => b.score - a.score);

        // Определяем порог аномалии и количество аномалий
        let threshold, anomalyCount;

        if (isTopNMode) {
            // Режим top-N: выбираем указанное количество самых аномальных записей
            anomalyCount = Math.min(sampleSize, population.length);
            // Порог - это минимальная оценка среди выбранных записей или 0, если не хватает записей
            threshold = anomalyCount > 0 ? indexScorePairs[Math.min(anomalyCount - 1, indexScorePairs.length - 1)].score : 0;
            console.log(`Выбираем топ-${anomalyCount} аномалий с порогом >= ${threshold.toFixed(4)}`);
        } else {
            // Режим доли аномалий: определяем количество аномалий исходя из contamination
            // При contamination='auto' используем то же значение, что и DEFAULT_CONTAMINATION
            const effectiveContamination = contamination === 'auto' ? DEFAULT_CONTAMINATION : contamination;
            anomalyCount = Math.round(population.length * effectiveContamination);
            // Порог - это минимальная оценка среди выбранных записей
            threshold = anomalyCount > 0 ? indexScorePairs[Math.min(anomalyCount - 1, indexScorePairs.length - 1)].score : 0;
            console.log(`Используем долю аномалий ${effectiveContamination}, количество: ${anomalyCount}, порог: ${threshold.toFixed(4)}`);
        }

        // Обновляем копию популяции с оценками аномальности
        // Заполняем аномальные оценки для ВСЕХ записей, но метка is_sample устанавливается отдельно
        for (let i = 0; i < populationCopy.length; i++) {
            populationCopy[i].anomaly_score = anomalyScores[i];
            populationCopy[i].is_sample = false;

            // Обязательно сохраняем идентификатор записи для сопоставления с оригинальными данными
            // (если он уже присутствует)
            if (population[i]._record_id !== undefined) {
                populationCopy[i]._record_id = population[i]._record_id;
            }
        }

        // Отдельно помечаем записи, которые попадают в выборку (топ-N записей)
        for (let i = 0; i < anomalyCount && i < indexScorePairs.length; i++) {
            const { index } = indexScorePairs[i];
            populationCopy[index].is_sample = true;
        }

        // Создание выборки из аномальных объектов
        const sample = populationCopy.filter(item => item.is_sample);
        console.log(`Выявлено ${sample.length} аномалий из ${populationCopy.length} записей`);

        // Создание описания метода выборки
        const methodDescription =
            `Метод выборки: Isolation Forest (выявление аномалий).\n` +
            `Общий размер популяции: ${population.length}.\n` +
            `Режим выборки: ${isTopNMode ? `топ-${sampleSize} аномалий` : `доля аномалий ${contamination === 'auto' ? 'auto' : contamination}`}.\n` +
            `Порог аномалии: ${threshold.toFixed(4)}.\n` +
            `Количество выявленных аномалий: ${sample.length} (${(sample.length / population.length * 100).toFixed(2)}%).\n` +
            `Количество деревьев: ${DEFAULT_ESTIMATORS} (оптимальное значение по умолчанию).\n` +
            `Использованные признаки: ${featuresToUse.join(', ')}.\n` +
            `Дата и время выборки: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}.\n`;

        console.log("Выборка методом Isolation Forest успешно завершена");

        return {
            population: populationCopy,
            sample,
            methodDescription,
            anomalyScores,
            threshold
        };
    } catch (error) {
        console.error(`Ошибка в createIsolationForestSample: ${error.message}`, error);
        return {
            population: null,
            sample: null,
            methodDescription: `Ошибка: ${error.message}`
        };
    }
}

// Реализация Isolation Forest адаптера для работы в браузере
class IsolationForestAdapter {
    /**
     * Создает новый экземпляр адаптера Isolation Forest
     * @param {Object} options - Параметры алгоритма
     * @param {number} [options.nEstimators=100] - Количество деревьев
     * @param {number} [options.maxSamples=256] - Максимальное количество выборок для построения дерева
     * @param {number} [options.contamination=0.1] - Ожидаемая доля аномалий (0-0.5)
     */
    constructor(options = {}) {
        this.options = {
            nEstimators: options.nEstimators || DEFAULT_ESTIMATORS,
            maxSamples: options.maxSamples || DEFAULT_MAX_SAMPLES,
            contamination: options.contamination || DEFAULT_CONTAMINATION
        };
        this.trees = [];
        this.trainingSet = null;
        this.threshold = DEFAULT_CONTAMINATION;
    }

    // Функция из Utils.js библиотеки - вычисление среднего пути
    averagePathLengthFromRoot(n) {
        if (n <= 1) return 0;
        return 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n;
    }

    // Создание узла дерева
    createNode(depth, maxDepth) {
        return {
            depth,
            maxDepth,
            splitColumn: null,
            splitValue: null,
            left: null,
            right: null,
            size: 0,

            isLeafNode() {
                return this.left === null && this.right === null;
            },

            isInnerNode() {
                return !this.isLeafNode();
            }
        };
    }

    // Случайный выбор подвыборки для обучения дерева
    getSubsample(data) {
        const maxSamples = this.options.maxSamples;
        if (data.length <= maxSamples) {
            return [...data]; // Если данных мало, используем все
        }

        // Случайно выбираем maxSamples элементов из data
        const indices = new Set();
        const result = [];

        while (indices.size < maxSamples) {
            const randIndex = Math.floor(Math.random() * data.length);
            if (!indices.has(randIndex)) {
                indices.add(randIndex);
                result.push(data[randIndex]);
            }
        }

        return result;
    }

    // Обучение узла дерева
    trainNode(node, trainingSet, currentDepth) {
        // Если достигли максимальной глубины или осталось 1 или меньше элементов, делаем лист
        if (currentDepth >= node.maxDepth || trainingSet.length <= 1) {
            node.size = trainingSet.length;
            return;
        }

        const numberFeatures = trainingSet[0].length;

        // Выбираем случайную колонку для разделения
        node.splitColumn = Math.floor(Math.random() * numberFeatures);

        // Получаем все значения по выбранной колонке
        const valuesForFeature = trainingSet.map(row => row[node.splitColumn]);

        // Находим min и max значения
        const maxValueFeature = Math.max(...valuesForFeature);
        const minValueFeature = Math.min(...valuesForFeature);

        // Если все значения одинаковые, делаем лист
        if (maxValueFeature === minValueFeature) {
            node.size = trainingSet.length;
            return;
        }

        // Выбираем случайное значение для разделения между min и max
        node.splitValue = Math.random() * (maxValueFeature - minValueFeature) + minValueFeature;

        // Разделяем данные на две группы
        const smallerThanSplitValue = trainingSet.filter(
            row => row[node.splitColumn] < node.splitValue
        );

        const biggerThanSplitValue = trainingSet.filter(
            row => row[node.splitColumn] >= node.splitValue
        );

        // Если одна из групп пустая, делаем лист
        if (smallerThanSplitValue.length === 0 || biggerThanSplitValue.length === 0) {
            node.size = trainingSet.length;
            return;
        }

        // Создаем дочерние узлы и обучаем их
        node.left = this.createNode(currentDepth + 1, node.maxDepth);
        node.right = this.createNode(currentDepth + 1, node.maxDepth);

        this.trainNode(node.left, smallerThanSplitValue, currentDepth + 1);
        this.trainNode(node.right, biggerThanSplitValue, currentDepth + 1);
    }

    // Вычисление длины пути от корня для указанной точки
    pathLengthFromRoot(node, data, currentPathLength) {
        if (node.isLeafNode()) {
            return currentPathLength + this.averagePathLengthFromRoot(node.size);
        }

        if (data[node.splitColumn] < node.splitValue) {
            return this.pathLengthFromRoot(node.left, data, currentPathLength + 1);
        } else {
            return this.pathLengthFromRoot(node.right, data, currentPathLength + 1);
        }
    }

    /**
     * Обучение изоляционного леса
     * @param {Array<Array<number>>} trainingSet - 2D массив числовых данных для обучения
     */
    train(trainingSet) {
        if (!trainingSet || !trainingSet.length) {
            throw new Error("Невозможно обучить модель на пустых данных");
        }

        this.trainingSet = trainingSet;
        const nEstimators = this.options.nEstimators;

        // Определяем максимальную глубину дерева
        // Для выборки размера n максимальная глубина примерно log2(n)
        const maxDepth = Math.ceil(Math.log2(trainingSet.length));

        // Очищаем предыдущие деревья
        this.trees = [];

        // Создаем и обучаем деревья
        for (let i = 0; i < nEstimators; i++) {
            // Для каждого дерева берем случайную подвыборку
            const subsample = this.getSubsample(trainingSet);

            // Создаем корневой узел и обучаем его
            const rootNode = this.createNode(0, maxDepth);
            this.trainNode(rootNode, subsample, 0);

            // Добавляем дерево в лес
            this.trees.push(rootNode);
        }
    }

    /**
     * Предсказание аномальных оценок
     * @param {Array<Array<number>>} data - 2D массив числовых данных для предсказания
     * @returns {Array<number>} - Массив оценок аномальности для каждой строки данных
     */
    predict(data) {
        if (!this.trees.length) {
            throw new Error("Модель не обучена");
        }

        const anomalyScores = [];
        const nEstimators = this.trees.length;

        // Для каждой строки данных
        for (const row of data) {
            let totalPathLength = 0;

            // Для каждого дерева в лесу
            for (const tree of this.trees) {
                // Считаем длину пути от корня до листа
                totalPathLength += this.pathLengthFromRoot(tree, row, 0);
            }

            // Средняя длина пути
            const avgPathLength = totalPathLength / nEstimators;

            // Формула для расчета оценки аномальности
            // Нормализуем длину пути, используя теоретическую среднюю длину пути
            const avgPathLengthExpected = this.averagePathLengthFromRoot(this.trainingSet.length);
            const anomalyScore = Math.pow(2, -avgPathLength / avgPathLengthExpected);

            anomalyScores.push(anomalyScore);
        }

        return anomalyScores;
    }
}

// Делаем функцию доступной глобально для использования в расширении Chrome
if (typeof window !== 'undefined') {
    // Проверяем, существует ли уже объект SamplingMethods
    window.SamplingMethods = window.SamplingMethods || {};

    // Регистрируем наш метод
    window.SamplingMethods.isolationForest = {
        /**
         * Выполняет выборку аномальных значений из массива данных.
         * @param {Array} data - Массив данных для выборки
         * @param {Object} options - Параметры выборки
         * @param {number} [options.sampleSize] - Размер выборки (топ-N аномалий)
         * @param {number|string} [options.contamination='auto'] - Ожидаемая доля аномалий или 'auto'
         * @param {Array<string>} [options.features] - Признаки для анализа
         * @returns {Object} - Объект с результатами выборки
         */
        sample: function (data, options = {}) {
            console.log("Вызван метод isolationForest.sample с параметрами:", {
                dataLength: data?.length,
                options
            });

            try {
                return createIsolationForestSample(data, options);
            } catch (error) {
                console.error("Ошибка в isolationForest.sample:", error);
                return {
                    population: null,
                    sample: null,
                    methodDescription: `Ошибка: ${error.message}`
                };
            }
        }
    };

    console.log("Метод isolationForest успешно зарегистрирован в SamplingMethods");
} 