/**
 * Выполняет выборку по монетарным единицам (MUS) из популяции.
 * 
 * @param {Array<Object>} population - Массив объектов, представляющий популяцию для выборки.
 * @param {number} sampleSize - Количество записей для выборки.
 * @param {string} valueColumn - Столбец, представляющий денежное значение для выборки.
 * @param {number|null} threshold - Минимальное значение в valueColumn для включения в выборку.
 * @param {string|null} strataColumn - Опциональный столбец для стратифицированной выборки.
 * @param {number|null} randomSeed - Seed для воспроизводимости.
 * @returns {Object} Объект, содержащий обновленную популяцию, выборку и описание метода.
 */
function monetaryUnitSampling(
  population,
  sampleSize,
  valueColumn,
  threshold = null,
  strataColumn = null,
  randomSeed = null
) {
  try {
    // Проверяем, что популяция - это массив
    if (!Array.isArray(population)) {
      throw new TypeError(`Ожидается, что populataion будет массивом, получен ${typeof population}`);
    }

    // Создаем копию популяции, чтобы избежать изменения исходных данных
    const populationCopy = JSON.parse(JSON.stringify(population));

    // Проверяем, что указанный valueColumn существует в популяции
    if (population.length > 0 && !(valueColumn in population[0])) {
      throw new Error(`Столбец '${valueColumn}' не найден в популяции`);
    }

    // Генерируем уникальный идентификатор для каждой строки популяции
    let nextId = 0;
    populationCopy.forEach(item => {
      item.unique_id = `id-${nextId++}`;
      item.is_sample = false;
    });

    // Получаем общий размер популяции и сумму столбца значений
    const totalPopulationSize = populationCopy.length;
    const totalPopulationValue = populationCopy.reduce((sum, item) => sum + (parseFloat(item[valueColumn]) || 0), 0);

    // Фильтруем популяцию на основе порога, если он предоставлен
    let populationFiltered;
    let postFilteredPopulationSize;

    if (threshold !== null) {
      populationFiltered = populationCopy.filter(item => parseFloat(item[valueColumn]) >= threshold);
      postFilteredPopulationSize = populationFiltered.length;
      if (postFilteredPopulationSize === 0) {
        throw new Error("После применения порога не осталось записей");
      }
    } else {
      populationFiltered = [...populationCopy];
      postFilteredPopulationSize = populationFiltered.length;
    }

    // Функция для выборки из страты на основе накопленного монетарного значения
    function sampleStratum(group, stratumSampleSize, seed) {
      // Если размер страты меньше или равен требуемому размеру выборки, вернуть всю группу
      if (group.length <= stratumSampleSize) {
        return [...group];
      }

      // Создаем генератор случайных чисел
      const random = createPrng(seed);

      // Рассчитываем накопленное значение внутри страты для выборки на основе монетарных единиц
      let cumulativeValue = 0;
      group.forEach(item => {
        cumulativeValue += parseFloat(item[valueColumn]) || 0;
        item.CumulativeVal = cumulativeValue;
      });

      const totalValue = cumulativeValue;

      // Если общее значение равно нулю, выполняем случайную выборку
      if (totalValue === 0) {
        const shuffled = [...group].sort(() => random() - 0.5);
        return shuffled.slice(0, stratumSampleSize);
      }

      // Определяем интервалы выборки на основе совокупного значения
      const interval = totalValue / stratumSampleSize;

      // Генерируем случайные точки выбора в пределах каждого интервала
      const selectionPoints = Array.from({ length: stratumSampleSize }, (_, i) =>
        random() * interval + i * interval
      );

      // Находим индексы записей, где накопленное значение пересекает точки выборки
      const sampleIndices = [];
      selectionPoints.forEach(point => {
        for (let i = 0; i < group.length; i++) {
          if (group[i].CumulativeVal >= point) {
            if (!sampleIndices.includes(i)) {
              sampleIndices.push(i);
            }
            break;
          }
        }
      });

      // Если количество уникальных индексов меньше требуемого, добавляем больше случайных точек
      while (sampleIndices.length < stratumSampleSize) {
        const newPoint = random() * totalValue;
        for (let i = 0; i < group.length; i++) {
          if (group[i].CumulativeVal >= newPoint) {
            if (!sampleIndices.includes(i)) {
              sampleIndices.push(i);
              break;
            }
          }
        }
      }

      // Возвращаем выбранные строки из группы
      return sampleIndices.slice(0, stratumSampleSize).map(index => group[index]);
    }

    let sample = [];

    // Если указан strataColumn, выполняем стратифицированную выборку
    if (strataColumn) {
      // Проверяем, существует ли strataColumn
      if (population.length > 0 && !(strataColumn in population[0])) {
        throw new Error(`Столбец '${strataColumn}' не найден в популяции`);
      }

      // Группируем популяцию по стратам
      const strata = {};
      populationFiltered.forEach(item => {
        const stratum = item[strataColumn];
        if (!strata[stratum]) {
          strata[stratum] = [];
        }
        strata[stratum].push(item);
      });

      // Рассчитываем размер каждой страты на основе пропорции населения
      let stratumSizes = {};
      const totalSize = populationFiltered.length;

      Object.keys(strata).forEach(stratum => {
        stratumSizes[stratum] = Math.round((strata[stratum].length / totalSize) * sampleSize);
      });

      // Корректируем размер выборки, если возникают ошибки округления
      let sizeSum = Object.values(stratumSizes).reduce((a, b) => a + b, 0);
      let sizeDiff = sampleSize - sizeSum;

      // Сортируем страты по размеру в убывающем порядке
      const sortedStrata = Object.keys(stratumSizes).sort((a, b) => stratumSizes[b] - stratumSizes[a]);

      // Корректируем размеры самых больших страт
      for (const stratum of sortedStrata) {
        if (stratumSizes[stratum] > 0) {
          stratumSizes[stratum] += sizeDiff > 0 ? 1 : -1;
          sizeDiff += sizeDiff > 0 ? -1 : 1;
        }
        if (sizeDiff === 0) break;
      }

      // Выборка из каждой страты индивидуально
      for (const [stratum, group] of Object.entries(strata)) {
        const stratumSampleSize = stratumSizes[stratum];
        if (stratumSampleSize === 0) continue;

        // Используем функцию sampleStratum для выбора записей из каждой страты
        const stratumSample = sampleStratum(group, stratumSampleSize, randomSeed);

        // Добавляем отобранные записи в итоговую выборку
        sample = [...sample, ...stratumSample];
      }
    } else {
      // Если стратификация не указана, выборка из всей отфильтрованной популяции
      sample = sampleStratum(populationFiltered, sampleSize, randomSeed);
    }

    // Помечаем элементы выборки
    sample.forEach(item => {
      item.is_sample = true;
    });

    // Идентифицируем уникальные идентификаторы отобранных записей
    const sampleIds = sample.map(item => item.unique_id);

    // Отмечаем выбранные записи в столбце 'is_sample'
    populationCopy.forEach(item => {
      if (sampleIds.includes(item.unique_id)) {
        item.is_sample = true;
      }
    });

    // Удаляем столбец unique_id из популяции и выборки для очистки
    populationCopy.forEach(item => delete item.unique_id);
    sample.forEach(item => delete item.unique_id);

    // Рассчитываем кумулятивное значение для всей популяции, чтобы оно было отображено в результатах
    if (strataColumn) {
      // Для стратифицированного MUS рассчитываем кумулятивные значения внутри каждой страты
      const strata = {};
      populationCopy.forEach(item => {
        const stratum = item[strataColumn];
        if (!strata[stratum]) {
          strata[stratum] = [];
        }
        strata[stratum].push(item);
      });

      // Для каждой страты рассчитываем кумулятивные значения
      for (const [_, group] of Object.entries(strata)) {
        let cumulativeValue = 0;
        // Сортируем группу по valueColumn для правильного кумулятивного расчета
        group.sort((a, b) => parseFloat(a[valueColumn]) - parseFloat(b[valueColumn]));
        group.forEach(item => {
          cumulativeValue += parseFloat(item[valueColumn]) || 0;
          item.CumulativeVal = cumulativeValue;
        });
      }
    } else {
      // Для обычного MUS рассчитываем кумулятивные значения для всей популяции
      let cumulativeValue = 0;
      // Сортируем популяцию по valueColumn для правильного кумулятивного расчета
      populationCopy.sort((a, b) => parseFloat(a[valueColumn]) - parseFloat(b[valueColumn]));
      populationCopy.forEach(item => {
        cumulativeValue += parseFloat(item[valueColumn]) || 0;
        item.CumulativeVal = cumulativeValue;
      });
    }

    // Формируем описание метода
    let methodDescription =
      `Метод выборки: Выборка по монетарным единицам.\n` +
      `Общий размер популяции: ${totalPopulationSize}.\n` +
      `Общая величина популяции: ${totalPopulationValue}.\n` +
      `Размер выборки: ${sampleSize}.\n` +
      `Столбец значений: ${valueColumn}.\n` +
      `Количество выбранных записей: ${sample.length}.\n` +
      `Кумулятивные значения: Расчитаны для всех элементов.\n`;

    // Включаем размер популяции после фильтрации только при применении порога
    if (threshold !== null) {
      methodDescription +=
        `Порог: ${threshold}.\n` +
        `Размер популяции после фильтрации: ${postFilteredPopulationSize}.\n`;
    }

    // Включаем детали стратификации, если применимо
    if (strataColumn) {
      methodDescription += `Страта выборки: ${strataColumn}.\n`;
    }

    // Включаем временную метку и информацию о случайном исходном значении в описание метода
    methodDescription +=
      `Дата и время выборки: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}.\n` +
      `Случайный seed: ${randomSeed}.\n` +
      `Метод кумулятивной выборки: ${strataColumn ? 'Да' : 'Нет'}.\n`;

    // Возвращаем обновленную популяцию, выборку и описание метода
    return {
      population: populationCopy,
      sample: sample,
      methodDescription: methodDescription
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

  // Простая реализация случайного генератора
  let currentSeed = seed;
  return function () {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
}

// Добавляем seedrandom для обеспечения воспроизводимости случайных чисел
// Это полифилл для Math.seedrandom
Math.seedrandom = function (seed) {
  let state = seed || Math.floor(Math.random() * 100000);

  return function () {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
};

// Пример использования - закомментирован для предотвращения ошибок
/*
function example() {
  // Создаем тестовый набор данных
  const testData = [];
  for (let i = 0; i < 1000; i++) {
    testData.push({
      id: i + 1,
      value: Math.random() * 1000,
      category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)]
    });
  }

  // Вызываем функцию monetaryUnitSampling
  const result = monetaryUnitSampling(
    testData,
    50,
    'value',
    100,  // порог
    'category',  // стратификация по категории
    12345  // случайный seed
  );

  console.log(result.methodDescription);
  console.log(`Количество записей в выборке: ${result.sample.length}`);

  return result;
}
*/

// Добавляем функцию createMUSSample в глобальный контекст для внутреннего использования
function createMUSSample(population, sampleSize, valueColumn, threshold = null, strataColumn = null, randomSeed = null) {
  return monetaryUnitSampling(population, sampleSize, valueColumn, threshold, strataColumn, randomSeed);
}

// Экспортируем функцию MUS в глобальный объект для расширения Chrome
if (typeof window !== 'undefined') {
  window.SamplingMethods = window.SamplingMethods || {};
  window.SamplingMethods.monetaryUnit = {
    /**
     * Выполняет выборку по монетарным единицам (MUS).
     * @param {Array} data - Массив данных для выборки
     * @param {Number} sampleSize - Размер выборки
     * @param {Function|String} valueAccessor - Функция доступа к денежному значению элемента или имя колонки
     * @param {Object} options - Дополнительные параметры
     * @returns {Object} - Объект с результатами выборки
     */
    sample: function (data, sampleSize, valueAccessor, options = {}) {
      // Определяем имя колонки для значений исходя из функции valueAccessor
      let valueColumn;
      const threshold = options.threshold !== undefined ? options.threshold : (options.ignoreZeroValues ? 0 : null);

      if (typeof valueAccessor === 'function') {
        // Пытаемся определить колонку из функции valueAccessor
        if (data && data.length > 0) {
          const item = data[0];
          // Используем все колонки и находим ту, которую использует функция valueAccessor
          const columns = Object.keys(item);
          for (const col of columns) {
            const val = parseFloat(item[col]);
            if (!isNaN(val) && valueAccessor(item) === val) {
              valueColumn = col;
              break;
            }
          }
        }
      } else {
        // Если передано имя колонки напрямую
        valueColumn = valueAccessor;
      }

      // Проверяем, что valueColumn определена
      if (!valueColumn) {
        throw new Error('Не удалось определить колонку для монетарных значений');
      }

      try {
        const result = monetaryUnitSampling(
          data,
          sampleSize,
          valueColumn,
          threshold,
          options.strataColumn,
          options.seed
        );

        // Проверяем результат перед возвратом
        if (!result || !result.sample) {
          console.error('MUS вернул некорректный результат:', result);
          throw new Error('Ошибка при выполнении MUS выборки');
        }

        return {
          population: result.population,
          sample: result.sample,
          methodDescription: result.methodDescription
        };
      } catch (error) {
        console.error('Ошибка при выполнении MUS выборки:', error);
        throw error;
      }
    }
  };

  // Для отладки
  console.log('Метод MUS загружен и доступен:', window.SamplingMethods.monetaryUnit.sample !== undefined);
}
