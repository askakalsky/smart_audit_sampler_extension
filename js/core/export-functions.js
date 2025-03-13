// Модуль для экспорта данных
window.ExportFunctions = {
    /**
     * Экспортирует данные в формат CSV
     * @param {Array} data - Массив данных для экспорта
     * @param {Array} headers - Массив заголовков
     * @returns {string} - CSV строка
     */
    exportToCSV: function (data, headers) {
        try {
            // Добавляем поле статуса к заголовкам
            const exportHeaders = ['is_sample', ...headers];

            // Создаем строку с заголовками
            let csvContent = exportHeaders.join(',') + '\n';

            // Добавляем строки данных
            data.forEach(item => {
                // Определяем статус
                const status = item.is_sample ? 1 : 0;

                const row = [status, ...headers.map(header => {
                    const value = item[header];
                    // Обрабатываем специальные символы и кавычки
                    if (value === null || value === undefined) return '';
                    const stringValue = String(value);
                    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                        return `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                })];
                csvContent += row.join(',') + '\n';
            });

            return csvContent;
        } catch (error) {
            console.error('Ошибка при создании CSV:', error);
            return null;
        }
    },

    /**
     * Экспортирует данные в формат XLSX
     * @param {Array} data - Массив данных для экспорта
     * @param {Array} headers - Массив заголовков
     * @returns {Uint8Array} - Бинарные данные XLSX
     */
    exportToXLSX: function (data, headers) {
        try {
            // Проверяем наличие библиотеки XLSX
            if (typeof XLSX === 'undefined') {
                throw new Error('Библиотека XLSX не загружена');
            }

            // Подготавливаем данные для Excel с добавлением статуса
            const excelData = data.map(item => {
                const row = {
                    'is_sample': item.is_sample ? 1 : 0
                };
                headers.forEach(header => {
                    row[header] = item[header];
                });
                return row;
            });

            // Создаем рабочую книгу
            const wb = XLSX.utils.book_new();

            // Добавляем поле статуса к заголовкам
            const exportHeaders = ['is_sample', ...headers];

            // Создаем лист с обновленными заголовками
            const ws = XLSX.utils.json_to_sheet(excelData, { header: exportHeaders });

            // Добавляем стили для заголовков
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_col(C) + "1";
                if (!ws[address]) continue;
                ws[address].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "CCCCCC" } }
                };
            }

            // Добавляем лист в книгу
            XLSX.utils.book_append_sheet(wb, ws, 'Sample Data');

            // Генерируем бинарные данные
            return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        } catch (error) {
            console.error('Ошибка при создании XLSX:', error);
            return null;
        }
    },

    /**
     * Отправляет данные на скачивание
     * @param {any} data - Данные для скачивания
     * @param {string} filename - Имя файла
     * @param {string} type - MIME-тип файла
     * @returns {Promise} - Промис, который разрешается после скачивания
     */
    sendDataForDownload: function (data, filename, type) {
        return new Promise((resolve, reject) => {
            try {
                let blob;
                if (type === 'text/csv') {
                    blob = new Blob([data], { type: type + ';charset=utf-8;' });
                } else {
                    blob = new Blob([data], { type: type });
                }

                // Создаем ссылку для скачивания
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;

                // Добавляем ссылку в документ
                document.body.appendChild(link);

                // Имитируем клик
                link.click();

                // Удаляем ссылку
                setTimeout(() => {
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                    resolve({ success: true, filename: filename });
                }, 100);
            } catch (error) {
                reject(error);
            }
        });
    }
}; 