const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'school.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Таблица материалов (добавлено поле course)
    db.run(`
        CREATE TABLE IF NOT EXISTS materials (
                                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                 type TEXT NOT NULL,
                                                 title TEXT NOT NULL,
                                                 description TEXT,
                                                 course TEXT,                   -- новый предмет (например, "фармакология")
                                                 hashtags TEXT,
                                                 pdf_url TEXT,
                                                 video_url TEXT,
                                                 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Таблица тестов (добавлен material_id)
    db.run(`
        CREATE TABLE IF NOT EXISTS tests (
                                             id INTEGER PRIMARY KEY AUTOINCREMENT,
                                             topic TEXT NOT NULL,
                                             title TEXT NOT NULL,
                                             description TEXT,
                                             material_id INTEGER,            -- ссылка на материал (если тест привязан)
                                             created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                             FOREIGN KEY(material_id) REFERENCES materials(id)
            )
    `);

    // 3. Таблица вопросов (без изменений)
    db.run(`
        CREATE TABLE IF NOT EXISTS questions (
                                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                 test_id INTEGER NOT NULL,
                                                 question_text TEXT NOT NULL,
                                                 options TEXT NOT NULL,
                                                 correct_option_index INTEGER NOT NULL,
                                                 FOREIGN KEY(test_id) REFERENCES tests(id)
            )
    `);

    // Наполнение демо-данными (с учётом новых полей)
    db.get("SELECT COUNT(*) as count FROM materials", (err, row) => {
        if (err) return console.error(err);
        if (row.count === 0) {
            // Материалы (теперь с course)
            const stmtMat = db.prepare(`
                INSERT INTO materials (type, title, description, course, hashtags, pdf_url, video_url)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            const demoMaterials = [
                ['реферат', 'Фармакология: Введение', 'Базовые принципы фармакокинетики.', 'фармакология', 'фармакология,введение', 'https://example.com/pharm1.pdf', null],
                ['реферат', 'Фармакология: Антибиотики', 'Полный обзор антибиотиков, механизмы действия.', 'фармакология', 'фармакология,антибиотики', 'https://example.com/antibiotics.pdf', null],
                ['видео', 'Физиология сердца', 'Видеоурок по физиологии.', 'физиология', 'физиология,видео', null, 'https://www.youtube.com/embed/dQw4w9WgXcQ']
            ];
            demoMaterials.forEach(m => stmtMat.run(m));
            stmtMat.finalize();

            // Тесты (теперь с material_id)
            const stmtTest = db.prepare(`
                INSERT INTO tests (topic, title, description, material_id)
                VALUES (?, ?, ?, ?)
            `);
            // Привязываем тест к первому материалу (id = 1) – для демонстрации
            const demoTests = [
                ['фармакология', 'Тест: Основы фармакологии', 'Проверка базовых знаний по теме', 1],
                ['фармакология', 'Тест: Антибиотики (Продвинутый)', 'Сложные вопросы по механизмам действия', 2]
            ];
            demoTests.forEach(t => stmtTest.run(t));
            stmtTest.finalize();

            // Вопросы
            const stmtQ = db.prepare(`INSERT INTO questions (test_id, question_text, options, correct_option_index) VALUES (?, ?, ?, ?)`);
            const demoQuestions = [
                [1, 'Что изучает фармакокинетика?', '["Действие лекарства на организм", "Движение лекарства в организме", "Химический состав лекарства"]', 1],
                [1, 'Что такое биодоступность?', '["Скорость выведения препарата", "Доля препарата, достигшая системного кровотока", "Токсичность препарата"]', 1],
                [2, 'Какой антибиотик ингибирует синтез клеточной стенки?', '["Пенициллин", "Тетрациклин", "Эритромицин"]', 0],
                [2, 'Что такое резистентность?', '["Усиление действия препарата", "Устойчивость микроорганизмов к препарату", "Аллергическая реакция"]', 1]
            ];
            demoQuestions.forEach(q => stmtQ.run(q));
            stmtQ.finalize();

            console.log('✅ Добавлены демо-материалы и тесты');
        }
    });
});

module.exports = db;