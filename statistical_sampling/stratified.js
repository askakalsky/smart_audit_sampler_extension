/**
 * Выполняет стратифицированную выборку из массива данных.
 * 
 * @param {Array} population - Массив объектов, представляющий популяцию для выборки.
 * @param {number} sampleSize - Общее количество записей для выбора в выборке.
 * @param {string} strataColumn - Название колонки для стратификации.
 * @param {number|null} randomSeed - Случайное зерно для воспроизводимости. По умолчанию null.
 * @returns {Object} Объект, содержащий обновленную популяцию, выборку и описание метода.
 * @throws {TypeError} Если популяция не является массивом.
 * @throws {Error} Если размер выборки больше размера популяции.
 */
function createStratifiedSample(population, sampleSize, strataColumn, randomSeed = null) {
    try {
        // Проверка, является ли популяция массивом
        if (!Array.isArray(population)) {
            throw new TypeError(`Ожидался массив для population, получен ${typeof population}`);
        }

        // Проверка, является ли размер выборки допустимым
        if (sampleSize > population.length) {
            throw new Error("Размер выборки не может быть больше размера популяции");
        }

        // Создаем копию популяции, чтобы не изменять исходный массив
        const populationCopy = population.map(item => ({ ...item, is_sample: 0 }));

        // Создаем генератор случайных чисел с заданным зерном
        const prng = createPrng(randomSeed);

        // Группируем данные по стратам
        const strata = {};
        populationCopy.forEach(item => {
            const stratum = item[strataColumn];
            if (!strata[stratum]) {
                strata[stratum] = [];
            }
            strata[stratum].push(item);
        });

        // Количество доступных страт
        const numStrata = Object.keys(strata).length;

        // Определяем страты, которые будем использовать для выборки
        let activeStrata;

        // Если количество страт больше размера выборки, 
        // выбираем только самые большие страты
        if (numStrata > sampleSize) {
            // Сортируем страты по размеру (от большей к меньшей)
            activeStrata = Object.entries(strata)
                .sort((a, b) => b[1].length - a[1].length)
                .slice(0, sampleSize)
                .map(([stratum]) => stratum);
        } else {
            // Используем все доступные страты
            activeStrata = Object.keys(strata);
        }

        // Вычисляем размер выборки для каждой страты пропорционально её размеру
        const strataInfo = {};
        let totalAllocated = 0;

        // Определяем общий размер активных страт для корректного расчета пропорций
        const totalActiveSize = activeStrata.reduce((sum, stratum) => sum + strata[stratum].length, 0);

        // Выделяем размер выборки для каждой активной страты
        activeStrata.forEach(stratum => {
            const items = strata[stratum];
            const proportion = items.length / totalActiveSize;
            let stratumSampleSize = Math.floor(sampleSize * proportion);

            // Убеждаемся, что каждая страта получит хотя бы один элемент,
            // но только если общего размера выборки хватает
            if (activeStrata.length <= sampleSize && stratumSampleSize === 0 && items.length > 0) {
                stratumSampleSize = 1;
            }

            // Убеждаемся, что мы не берем больше элементов, чем имеется в страте
            stratumSampleSize = Math.min(stratumSampleSize, items.length);

            strataInfo[stratum] = {
                size: items.length,
                sampleSize: stratumSampleSize,
                proportion
            };
            totalAllocated += stratumSampleSize;
        });

        // Для неактивных страт указываем нулевой размер выборки
        Object.keys(strata).forEach(stratum => {
            if (!activeStrata.includes(stratum)) {
                strataInfo[stratum] = {
                    size: strata[stratum].length,
                    sampleSize: 0,
                    proportion: 0
                };
            }
        });

        // Распределяем оставшиеся элементы, но не превышаем запрошенный размер выборки
        let remaining = sampleSize - totalAllocated;

        if (remaining > 0) {
            // Сортируем активные страты по размеру (от большей к меньшей)
            const sortedActiveStrata = [...activeStrata].sort((a, b) => strata[b].length - strata[a].length);

            // Распределяем оставшиеся элементы по стратам
            for (const stratum of sortedActiveStrata) {
                if (remaining <= 0) break;

                const items = strata[stratum];
                const availableSpace = items.length - strataInfo[stratum].sampleSize;

                if (availableSpace > 0) {
                    const additionalElements = Math.min(remaining, availableSpace);
                    strataInfo[stratum].sampleSize += additionalElements;
                    remaining -= additionalElements;
                }
            }
        }

        // Выбираем элементы из каждой страты
        const selectedIndices = new Set();
        Object.entries(strata).forEach(([stratum, items]) => {
            const stratumSampleSize = strataInfo[stratum].sampleSize;
            const indices = Array.from({ length: items.length }, (_, i) => i);

            // Перемешиваем индексы
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(prng() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }

            // Выбираем элементы
            for (let i = 0; i < stratumSampleSize; i++) {
                const itemIndex = populationCopy.indexOf(items[indices[i]]);
                selectedIndices.add(itemIndex);
            }
        });

        // Помечаем выбранные элементы в популяции
        selectedIndices.forEach(index => {
            populationCopy[index].is_sample = true;
        });

        // Создаем выборку
        const sample = Array.from(selectedIndices).map(index => ({ ...populationCopy[index] }));

        // Создаем описание метода выборки
        const strataDescription = Object.entries(strataInfo)
            .map(([stratum, info]) =>
                `  ${stratum}: размер=${info.size}, выборка=${info.sampleSize}, пропорция=${info.proportion.toFixed(4)}`
            )
            .join('\n');

        const methodDescription =
            `Метод выборки: Стратифицированная выборка.\n` +
            `Общий размер популяции: ${population.length}.\n` +
            `Размер выборки: ${sampleSize}.\n` +
            `Фактический размер выборки: ${sample.length}.\n` +
            `Колонка стратификации: ${strataColumn}.\n` +
            `Информация о стратах:\n${strataDescription}\n` +
            `Дата и время выборки: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}.\n` +
            `Случайное зерно: ${randomSeed}.\n`;

        return {
            population: populationCopy,
            sample,
            methodDescription
        };
    } catch (error) {
        console.error(`Ошибка: ${error.message}`);
        return {
            population: null,
            sample: null,
            methodDescription: `Ошибка: ${error.message}`
        };
    }
}

/**
 * Создает псевдослучайный генератор чисел с возможностью установки зерна.
 * Если зерно не указано, использует Math.random().
 * 
 * @param {number|null} seed - Зерно для генератора.
 * @returns {Function} Функция, возвращающая псевдослучайное число в диапазоне [0, 1).
 */
function createPrng(seed) {
    if (seed === null) {
        return Math.random;
    }

    // Простая реализация случайного генератора на основе линейного конгруэнтного метода
    let currentSeed = seed;
    return function () {
        const a = 1664525;
        const c = 1013904223;
        const m = Math.pow(2, 32);
        currentSeed = (a * currentSeed + c) % m;
        return currentSeed / m;
    };
}

// Делаем функцию доступной глобально для использования в расширении Chrome
if (typeof window !== 'undefined') {
    window.SamplingMethods = window.SamplingMethods || {};
    window.SamplingMethods.stratified = {
        /**
         * Выполняет стратифицированную выборку из массива данных.
         * @param {Array} data - Массив данных для выборки
         * @param {Number} sampleSize - Размер выборки
         * @param {Function} stratifyBy - Функция, определяющая страту для элемента
         * @param {Object} options - Дополнительные параметры
         * @returns {Object} - Объект с результатами выборки
         */
        sample: function (data, options = {}) {
            // Получаем параметры из options
            let sampleSize, stratifyColumn, seed, proportional;

            // Обработка разных форматов аргументов для обратной совместимости
            if (typeof options === 'object') {
                // Новый формат - объект options
                sampleSize = options.sampleSize;
                stratifyColumn = options.stratifyColumn;
                seed = options.seed;
                proportional = options.proportional !== undefined ? options.proportional : true;
            } else {
                // Старый формат - аргументы по порядку
                sampleSize = arguments[1];
                stratifyColumn = arguments[2];
                seed = arguments[3]?.seed;
                proportional = true; // По умолчанию пропорциональное распределение
            }

            console.log('Стратифицированная выборка, параметры:', {
                sampleSize,
                stratifyColumn,
                seed,
                proportional
            });

            // Проверяем наличие необходимых параметров
            if (sampleSize === undefined || sampleSize <= 0) {
                throw new Error('Неверный размер выборки');
            }

            if (!stratifyColumn) {
                throw new Error('Не указана колонка для стратификации');
            }

            // Создаем параметры для вызова createStratifiedSample
            const params = {
                population: data,
                sampleSize: sampleSize,
                strataColumn: stratifyColumn,
                seed: seed,
                proportional: proportional
            };

            // Вызываем базовую функцию стратификации с обновлёнными параметрами
            return createStratifiedSampleProportional(
                params.population,
                params.sampleSize,
                params.strataColumn,
                params.proportional,
                params.seed
            );
        }
    };
}

/**
 * Выполняет стратифицированную выборку из массива данных с учетом пропорционального распределения.
 */
function createStratifiedSampleProportional(population, sampleSize, strataColumn, proportional = true, randomSeed = null) {
    try {
        // Проверка, является ли популяция массивом
        if (!Array.isArray(population)) {
            throw new TypeError(`Ожидался массив для population, получен ${typeof population}`);
        }

        // Проверка, является ли размер выборки допустимым
        if (sampleSize > population.length) {
            throw new Error("Размер выборки не может быть больше размера популяции");
        }

        // Проверка наличия колонки стратификации
        if (!strataColumn || !population.length || !(strataColumn in population[0])) {
            throw new Error(`Колонка "${strataColumn}" не найдена в данных`);
        }

        // Создаем копию популяции, чтобы не изменять исходный массив
        const populationCopy = population.map(item => ({ ...item, is_sample: false }));

        // Создаем генератор случайных чисел с заданным зерном
        const prng = createPrng(randomSeed);

        // Группируем данные по стратам
        const strata = {};
        populationCopy.forEach(item => {
            const stratum = item[strataColumn];
            if (!strata[stratum]) {
                strata[stratum] = [];
            }
            strata[stratum].push(item);
        });

        // Количество доступных страт
        const numStrata = Object.keys(strata).length;

        // Убедимся, что колонка для стратификации содержит более одной страты
        if (numStrata <= 1) {
            throw new Error(`Колонка "${strataColumn}" содержит только одну страту (${numStrata})`);
        }

        console.log(`Найдено ${numStrata} страт в колонке "${strataColumn}"`);

        // Вычисляем размер выборки для каждой страты
        const strataInfo = {};
        let totalAllocated = 0;

        // Определяем общий размер популяции для корректного расчета пропорций
        const totalSize = populationCopy.length;

        // Распределяем элементы выборки по стратам
        Object.entries(strata).forEach(([stratum, items]) => {
            const stratumSize = items.length;
            let stratumSampleSize;

            if (proportional) {
                // Пропорциональное распределение
                const proportion = stratumSize / totalSize;
                stratumSampleSize = Math.round(sampleSize * proportion);
            } else {
                // Равномерное распределение
                stratumSampleSize = Math.floor(sampleSize / numStrata);
            }

            // Убеждаемся, что мы не берем больше элементов, чем имеется в страте
            stratumSampleSize = Math.min(stratumSampleSize, stratumSize);

            // Убеждаемся, что каждая страта получит хотя бы один элемент,
            // но только если общего размера выборки хватает
            if (numStrata <= sampleSize && stratumSampleSize === 0 && stratumSize > 0) {
                stratumSampleSize = 1;
            }

            strataInfo[stratum] = {
                size: stratumSize,
                sampleSize: stratumSampleSize,
                proportion: stratumSize / totalSize
            };

            totalAllocated += stratumSampleSize;
        });

        // Распределяем оставшиеся элементы или убираем лишние
        let remaining = sampleSize - totalAllocated;

        if (remaining !== 0) {
            console.log(`Требуется перераспределить ${remaining} элементов`);

            // Сортируем страты по пропорции (от большей к меньшей)
            const sortedStrata = Object.entries(strataInfo)
                .sort((a, b) => {
                    const aRatio = a[1].sampleSize / a[1].size;
                    const bRatio = b[1].sampleSize / b[1].size;
                    return remaining > 0
                        ? aRatio - bRatio  // При нехватке добавляем к тем, где меньше пропорция
                        : bRatio - aRatio; // При избытке убираем у тех, где больше пропорция
                })
                .map(([stratum]) => stratum);

            // Перераспределяем элементы
            for (const stratum of sortedStrata) {
                if (remaining === 0) break;

                const info = strataInfo[stratum];
                const stratumSize = info.size;

                if (remaining > 0) {
                    // Нужно добавить элементы
                    const availableSpace = stratumSize - info.sampleSize;
                    if (availableSpace > 0) {
                        const add = Math.min(remaining, availableSpace);
                        info.sampleSize += add;
                        remaining -= add;
                    }
                } else {
                    // Нужно убрать элементы
                    const remove = Math.min(Math.abs(remaining), info.sampleSize - 1);
                    if (remove > 0) {
                        info.sampleSize -= remove;
                        remaining += remove;
                    }
                }
            }
        }

        // Проверяем, что размер выборки соответствует заданному
        const finalSampleSize = Object.values(strataInfo).reduce((sum, info) => sum + info.sampleSize, 0);
        console.log(`Итоговый размер выборки: ${finalSampleSize} (запрошено: ${sampleSize})`);

        // Выбираем элементы из каждой страты
        const selectedIndices = new Set();

        Object.entries(strata).forEach(([stratum, items]) => {
            const stratumSampleSize = strataInfo[stratum].sampleSize;

            if (stratumSampleSize <= 0) return;

            // Перемешиваем страту
            const shuffledItems = [...items];
            for (let i = shuffledItems.length - 1; i > 0; i--) {
                const j = Math.floor(prng() * (i + 1));
                [shuffledItems[i], shuffledItems[j]] = [shuffledItems[j], shuffledItems[i]];
            }

            // Выбираем первые stratumSampleSize элементов
            for (let i = 0; i < stratumSampleSize; i++) {
                const item = shuffledItems[i];
                const itemIndex = populationCopy.findIndex(x => x === item);
                if (itemIndex !== -1) {
                    selectedIndices.add(itemIndex);
                }
            }
        });

        // Помечаем выбранные элементы в популяции
        selectedIndices.forEach(index => {
            populationCopy[index].is_sample = true;
        });

        // Создаем выборку
        const sample = Array.from(selectedIndices).map(index => ({ ...populationCopy[index] }));

        // Создаем описание метода выборки
        const strataDescription = Object.entries(strataInfo)
            .map(([stratum, info]) =>
                `  ${stratum}: размер=${info.size}, выборка=${info.sampleSize}, пропорция=${info.proportion.toFixed(4)}`
            )
            .join('\n');

        const methodDescription =
            `Метод выборки: Стратифицированная выборка.\n` +
            `Тип распределения: ${proportional ? 'Пропорциональное' : 'Равномерное'}.\n` +
            `Общий размер популяции: ${population.length}.\n` +
            `Заданный размер выборки: ${sampleSize}.\n` +
            `Фактический размер выборки: ${sample.length}.\n` +
            `Колонка стратификации: ${strataColumn}.\n` +
            `Информация о стратах:\n${strataDescription}\n` +
            `Дата и время выборки: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}.\n` +
            `Случайное зерно: ${randomSeed || 'не задано'}.\n`;

        return {
            population: populationCopy,
            sample,
            methodDescription
        };
    } catch (error) {
        console.error(`Ошибка стратифицированной выборки: ${error.message}`);
        throw error;
    }
}

// Пример использования:
/*
const data = [
  { id: 1, group: 'A', value: 10 },
  { id: 2, group: 'A', value: 20 },
  { id: 3, group: 'B', value: 30 },
  { id: 4, group: 'B', value: 40 },
  { id: 5, group: 'C', value: 50 },
  { id: 6, group: 'C', value: 60 }
];

const result = stratifiedSampling(data, 3, 'group', 42);
console.log(result.methodDescription);
console.log('Sample:', result.sample);
*/
