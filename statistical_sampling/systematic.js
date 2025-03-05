/**
 * Выполняет систематическую выборку из массива данных.
 * 
 * @param {Array} population - Массив объектов, представляющий популяцию для выборки.
 * @param {Object} options - Параметры выборки
 * @param {number} options.sampleSize - Количество записей для выбора в выборке
 * @param {number} options.startPoint - Начальная точка для выборки (0-based)
 * @returns {Object} Объект, содержащий обновленную популяцию, выборку и описание метода.
 * @throws {TypeError} Если популяция не является массивом.
 * @throws {Error} Если размер выборки больше размера популяции.
 */
function createSystematicSample(population, options) {
  try {
    // Проверка, является ли популяция массивом
    if (!Array.isArray(population)) {
      throw new TypeError(`Ожидался массив для population, получен ${typeof population}`);
    }

    const sampleSize = options.sampleSize;
    let startPoint = options.startPoint || 0;

    // Проверка, является ли размер выборки допустимым
    if (sampleSize > population.length) {
      throw new Error("Размер выборки не может быть больше размера популяции");
    }

    if (sampleSize <= 0) {
      throw new Error("Размер выборки должен быть положительным числом");
    }

    // Создаем копию популяции, чтобы не изменять исходный массив
    const populationCopy = population.map(item => ({ ...item, is_sample: false }));

    // Вычисляем интервал выборки (шаг)
    const interval = population.length / sampleSize;

    // Нормализуем начальную точку
    startPoint = startPoint % interval;
    if (startPoint < 0) startPoint = 0;

    // Выбираем элементы через равные интервалы
    const selectedIndices = [];
    for (let i = startPoint; selectedIndices.length < sampleSize; i += interval) {
      const index = Math.floor(i);
      if (index >= population.length) break;
      selectedIndices.push(index);
    }

    // Если не хватает элементов из-за округления, добираем с начала
    if (selectedIndices.length < sampleSize) {
      let i = 0;
      while (selectedIndices.length < sampleSize && i < population.length) {
        if (!selectedIndices.includes(i)) {
          selectedIndices.push(i);
        }
        i++;
      }
    }

    // Сортируем индексы для сохранения порядка
    selectedIndices.sort((a, b) => a - b);

    // Помечаем выбранные элементы в популяции
    selectedIndices.forEach(index => {
      populationCopy[index].is_sample = true;
    });

    // Создаем выборку
    const sample = selectedIndices.map(index => ({ ...populationCopy[index] }));

    // Создаем описание метода выборки
    const methodDescription =
      `Метод выборки: Систематическая выборка\n` +
      `Общий размер популяции: ${population.length}\n` +
      `Размер выборки: ${sampleSize}\n` +
      `Интервал выборки: ${interval.toFixed(2)}\n` +
      `Начальная точка: ${startPoint}\n` +
      `Количество выбранных записей: ${sample.length}\n` +
      `Дата и время выборки: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`;

    return {
      population: populationCopy,
      sample,
      methodDescription
    };
  } catch (error) {
    console.error(`Ошибка в систематической выборке: ${error.message}`);
    throw error;
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
  window.SamplingMethods.systematic = {
    /**
     * Выполняет систематическую выборку из массива данных.
     * @param {Array} data - Массив данных для выборки
     * @param {Object} options - Параметры выборки
     * @param {number} options.sampleSize - Размер выборки
     * @param {number} options.startPoint - Начальная точка для выборки
     * @returns {Object} - Объект с результатами выборки
     */
    sample: function (data, options) {
      if (!options || typeof options !== 'object') {
        throw new Error('Необходимо передать объект с параметрами выборки');
      }

      if (!options.sampleSize) {
        throw new Error('Не указан размер выборки (sampleSize)');
      }

      const result = createSystematicSample(data, {
        sampleSize: parseInt(options.sampleSize, 10),
        startPoint: parseInt(options.startPoint || 0, 10)
      });

      return {
        population: result.population,
        sample: result.sample,
        methodDescription: result.methodDescription
      };
    }
  };
}

// Пример использования:
/*
const data = [
  { id: 1, name: 'A', value: 10 },
  { id: 2, name: 'B', value: 20 },
  { id: 3, name: 'C', value: 30 },
  { id: 4, name: 'D', value: 40 },
  { id: 5, name: 'E', value: 50 },
  { id: 6, name: 'F', value: 60 },
  { id: 7, name: 'G', value: 70 },
  { id: 8, name: 'H', value: 80 },
  { id: 9, name: 'I', value: 90 },
  { id: 10, name: 'J', value: 100 }
];

const result = systematicSampling(data, 3, 42);
console.log(result.methodDescription);
console.log('Sample:', result.sample);
*/
