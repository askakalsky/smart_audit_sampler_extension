/**
 * Скрипт для исправления отображения колонок is_sample и anomaly_score в таблице
 * предобработанных данных на вкладке "Подробности".
 */
(function () {
    // Функция, которая будет вызвана после полной загрузки страницы
    function fixTableDisplay() {
        // Проверяем, есть ли нужная функция
        if (typeof displayPreprocessedData !== 'function') {
            console.warn('Функция displayPreprocessedData не найдена');
            return;
        }

        // Сохраняем оригинальную функцию
        const originalDisplayPreprocessedData = displayPreprocessedData;

        // Переопределяем функцию
        displayPreprocessedData = function () {
            try {
                // Получаем данные для отображения
                const dataManager = window.dataManager;
                if (!dataManager) {
                    return originalDisplayPreprocessedData();
                }

                // Получаем предобработанные данные
                let preprocessedData = dataManager.getTransformedData();
                if (!preprocessedData || !Array.isArray(preprocessedData) || preprocessedData.length === 0) {
                    return originalDisplayPreprocessedData();
                }

                // Получаем оригинальные данные
                const originalData = dataManager.getOriginalData() || [];

                // Создаем карту для быстрого поиска по _record_id
                const originalMap = {};
                originalData.forEach(item => {
                    if (item._record_id !== undefined) {
                        originalMap[item._record_id] = item;
                    }
                });

                // Обогащаем предобработанные данные значениями is_sample и anomaly_score из оригинальных данных
                const enrichedData = preprocessedData.map(item => {
                    const result = { ...item };

                    // Если есть _record_id и соответствующая запись в оригинальных данных
                    if (item._record_id !== undefined && originalMap[item._record_id]) {
                        const origItem = originalMap[item._record_id];

                        // Добавляем is_sample, если его нет
                        if (result.is_sample === undefined && origItem.is_sample !== undefined) {
                            result.is_sample = origItem.is_sample;
                        }

                        // Добавляем anomaly_score, если его нет
                        if (result.anomaly_score === undefined && origItem.anomaly_score !== undefined) {
                            result.anomaly_score = origItem.anomaly_score;
                        }
                    }

                    return result;
                });

                // Заменяем оригинальную функцию displayPreprocessedData на нашу версию
                window.displayPreprocessedData = function () {
                    try {
                        // Оставляем большую часть логики оригинальной функции, но меняем некоторые моменты

                        // Получаем предобработанные данные (используем наши обогащенные данные)
                        let transformationInfo = {};

                        // Получаем информацию о преобразованиях
                        if (window.dataManager.state && window.dataManager.state.mlMetadata) {
                            transformationInfo = window.dataManager.state.mlMetadata.transformations[
                                window.dataManager.state.mlMetadata.transformations.length - 1
                            ] || {};
                        }

                        // Получаем контейнеры для отображения результатов
                        const preprocessedStatsContainer = document.getElementById('preprocessedStats');
                        const preprocessedResultsContainer = document.getElementById('preprocessedResults');
                        if (!preprocessedStatsContainer || !preprocessedResultsContainer) return;

                        // Отображаем статистику о предобработанных данных (как в оригинальной функции)
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
                                        <span class="badge bg-primary">Записей: ${enrichedData.length}</span>
                                        <span class="badge bg-info">Признаков: ${transformationInfo.features ? transformationInfo.features.length : 'N/A'}</span>
                                        <span class="badge bg-secondary">Метод: Isolation Forest</span>
                                    </div>
                        `;

                        // Добавляем информацию о преобразованиях
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
                        const firstItem = enrichedData[0];

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

                        // Формируем порядок колонок (ИЗМЕНЕНО!)
                        let orderedColumns = [];

                        // Сначала _record_id, если есть
                        if (allColumns.includes('_record_id')) {
                            orderedColumns.push('_record_id');
                        }

                        // Затем is_sample и anomaly_score, если они есть (ИЗМЕНЕНО!)
                        if (allColumns.includes('is_sample')) {
                            orderedColumns.push('is_sample');
                        }
                        if (allColumns.includes('anomaly_score')) {
                            orderedColumns.push('anomaly_score');
                        }

                        // Затем оригинальные колонки
                        dataOriginalColumns.forEach(col => {
                            orderedColumns.push(col);
                        });

                        // Добавляем трансформированные колонки
                        transformedColumns.forEach(col => {
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
                            const isSpecial = header === 'is_sample' || header === 'anomaly_score';

                            // Определяем, является ли это нормализованным числовым признаком
                            const isNormalizedNumeric = isTransformed && !header.substring(1).includes('_');

                            // Определяем стиль заголовка
                            let headerClass;
                            if (isUsedFeature) {
                                headerClass = 'text-white'; // Колонки для обучения
                                headerClass += '" style="background-color: #4285F4;'; // Google Blue
                            } else if (isNormalizedNumeric) {
                                headerClass = 'text-white'; // Нормализованные числовые признаки
                                headerClass += '" style="background-color: #8AB4F8;'; // Light Google Blue
                            } else if (isTransformed && !isNormalizedNumeric) {
                                headerClass = 'text-white'; // Бинарные признаки
                                headerClass += '" style="background-color: #BDC1C6;'; // Light Google Gray
                            } else if (isOriginal) {
                                headerClass = 'text-white'; // Оригинальные колонки
                                headerClass += '" style="background-color: #F28B82;'; // Light Google Red
                            } else if (isSpecial) {
                                headerClass = 'text-white'; // Специальные колонки (is_sample, anomaly_score)
                                headerClass += '" style="background-color: #81C995;'; // Light Google Green
                            } else {
                                headerClass = 'text-white" style="background-color: #FDD663;'; // Light Google Yellow
                            }

                            // Для _record_id отображаем "#", как на вкладке Результаты
                            const displayName = header === '_record_id' ? '#' : header;

                            tableHtml += `<th scope="col" class="text-center ${headerClass}">${displayName}</th>`;
                        });

                        tableHtml += `
                                            </tr>
                                          </thead>
                                          <tbody>
                                            `;

                        // Добавляем первые 10 строк данных
                        const maxRows = Math.min(enrichedData.length, 10);
                        for (let i = 0; i < maxRows; i++) {
                            const item = enrichedData[i];

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
                                const isSpecial = header === 'is_sample' || header === 'anomaly_score';

                                // Определяем, является ли это нормализованным числовым признаком
                                const isNormalizedNumeric = isTransformed && !header.substring(1).includes('_');

                                // Форматируем значение в зависимости от его типа
                                let formattedValue;
                                if (value === null || value === undefined) {
                                    // Если значения нет, но это особые колонки, используем default значения
                                    if (header === 'is_sample') {
                                        formattedValue = '<span class="badge bg-secondary">Не выбран</span>';
                                    } else if (header === 'anomaly_score') {
                                        formattedValue = 'N/A';
                                    } else {
                                        formattedValue = '<span class="text-muted">NULL</span>';
                                    }
                                } else if (typeof value === 'number') {
                                    // Обычное отображение для всех числовых значений без бейджей
                                    formattedValue = value.toFixed(4).replace(/\.?0+$/, '');
                                } else if (typeof value === 'boolean') {
                                    if (header === 'is_sample') {
                                        // ИЗМЕНЕНО: Для is_sample показываем "В выборке" или "Не выбран"
                                        formattedValue = value ?
                                            '<span class="badge bg-success">В выборке</span>' :
                                            '<span class="badge bg-secondary">Не выбран</span>';
                                    } else {
                                        formattedValue = value ?
                                            '<span class="badge bg-success">TRUE</span>' :
                                            '<span class="badge bg-danger">FALSE</span>';
                                    }
                                } else if (header === 'is_sample') {
                                    // ИЗМЕНЕНО: Для is_sample показываем "В выборке" или "Не выбран"
                                    formattedValue = value ?
                                        '<span class="badge bg-success">В выборке</span>' :
                                        '<span class="badge bg-secondary">Не выбран</span>';
                                } else {
                                    formattedValue = String(value);
                                }

                                // Ячейки не нужно специально стилизовать, так как заголовки уже стилизованы
                                tableHtml += `<td>${formattedValue}</td>`;
                            });

                            tableHtml += '</tr>';
                        }

                        // Добавляем сообщение, что показаны не все данные
                        if (enrichedData.length > maxRows) {
                            tableHtml += `
                                <tr>
                                    <td colspan="${orderedColumns.length}" class="text-center text-muted">
                                        <em>Показаны первые ${maxRows} из ${enrichedData.length} записей</em>
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
                        console.error('Ошибка в patched displayPreprocessedData:', error);
                        // Если что-то пошло не так, вызываем оригинальную функцию
                        originalDisplayPreprocessedData();
                    }
                };

                // Вызываем нашу модифицированную функцию
                window.displayPreprocessedData();

                return;
            } catch (error) {
                console.error('Ошибка в патче displayPreprocessedData:', error);
                // В случае ошибки вызываем оригинальную функцию
                return originalDisplayPreprocessedData();
            }
        };

        console.log('Патч для отображения таблицы успешно применен');
    }

    // Запускаем функцию исправления через 1 секунду после загрузки
    setTimeout(fixTableDisplay, 1000);
})(); 