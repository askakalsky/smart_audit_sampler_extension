/**
 * Выполняет случайную выборку из массива данных.
 * 
 * @param {Array} population - Массив объектов, представляющий популяцию для выборки.
 * @param {number} sampleSize - Количество записей для выбора в выборке.
 * @param {number|null} randomSeed - Случайное зерно для воспроизводимости. По умолчанию null.
 * @returns {Object} Объект, содержащий обновленную популяцию, выборку и описание метода.
 * @throws {TypeError} Если популяция не является массивом.
 * @throws {Error} Если размер выборки больше размера популяции.
 */
function createRandomSample(population, sampleSize, randomSeed = null) {
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

    // Создаем индексы для случайного выбора
    const indices = Array.from({ length: population.length }, (_, i) => i);

    // Перемешиваем индексы с использованием алгоритма Фишера-Йейтса
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Выбираем первые sampleSize элементов
    const selectedIndices = indices.slice(0, sampleSize);

    // Помечаем выбранные элементы в популяции
    selectedIndices.forEach(index => {
      populationCopy[index].is_sample = true;
    });

    // Создаем выборку
    const sample = selectedIndices.map(index => ({ ...populationCopy[index] }));

    // Создаем описание метода выборки
    const methodDescription =
      `Метод выборки: Случайная выборка.\n` +
      `Общий размер популяции: ${population.length}.\n` +
      `Размер выборки: ${sampleSize}.\n` +
      `Количество выбранных записей: ${sample.length}.\n` +
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
  window.SamplingMethods.random = {
    /**
     * Выполняет случайную выборку из массива данных.
     * @param {Array} data - Массив данных для выборки
     * @param {Number} sampleSize - Размер выборки
     * @param {Object} options - Дополнительные параметры
     * @returns {Object} - Объект с результатами выборки
     */
    sample: function (data, sampleSize, options = {}) {
      const result = createRandomSample(data, sampleSize, options.seed);
      return {
        population: result.population,
        sample: result.sample,
        methodDescription: result.methodDescription
      };
    }
  };
}