require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { Telegraf, session } = require('telegraf');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Настройка бота ----------
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌ Ошибка: BOT_TOKEN не задан в .env');
    process.exit(1);
}
const bot = new Telegraf(BOT_TOKEN);

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ---------- Создание папки для загрузок ----------
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Настройка multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ---------- Административный токен ----------
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'secret_admin_token';

function adminAuth(req, res, next) {
    const token = req.headers['x-admin-token'];
    if (token === ADMIN_TOKEN) return next();
    res.status(403).json({ error: 'Недостаточно прав' });
}

// ---------- API Материалов ----------
app.get('/api/materials', (req, res) => {
    const { tags, course } = req.query;
    let sql = 'SELECT * FROM materials';
    let params = [];
    let conditions = [];
    if (tags) {
        const tagArray = tags.split(',').map(t => t.trim());
        const cond = tagArray.map(() => 'hashtags LIKE ?').join(' OR ');
        conditions.push(`(${cond})`);
        params.push(...tagArray.map(t => `%${t}%`));
    }
    if (course) {
        conditions.push('course = ?');
        params.push(course);
    }
    if (conditions.length) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/materials/:id', (req, res) => {
    db.get('SELECT * FROM materials WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Материал не найден' });
        res.json(row);
    });
});

// ---------- API Тестов ----------
app.get('/api/tests', (req, res) => {
    const { topic, material_id } = req.query;
    let sql = 'SELECT * FROM tests';
    let params = [];
    let conditions = [];
    if (topic) {
        conditions.push('topic LIKE ?');
        params.push(`%${topic}%`);
    }
    if (material_id) {
        conditions.push('material_id = ?');
        params.push(material_id);
    }
    if (conditions.length) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/tests/:id', (req, res) => {
    const testId = req.params.id;
    db.get('SELECT * FROM tests WHERE id = ?', [testId], (err, test) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!test) return res.status(404).json({ error: 'Тест не найден' });
        db.all('SELECT * FROM questions WHERE test_id = ?', [testId], (err, questions) => {
            if (err) return res.status(500).json({ error: err.message });
            const formatted = questions.map(q => ({
                ...q,
                options: JSON.parse(q.options)
            }));
            res.json({ ...test, questions: formatted });
        });
    });
});

// ---------- Административные API (с токеном) ----------
app.post('/api/materials', adminAuth, (req, res) => {
    const { type, title, description, course, hashtags, pdf_url, video_url } = req.body;
    if (!type || !title) {
        return res.status(400).json({ error: 'type и title обязательны' });
    }
    const sql = `
        INSERT INTO materials (type, title, description, course, hashtags, pdf_url, video_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(sql, [type, title, description, course, hashtags, pdf_url, video_url], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID });
    });
});

app.put('/api/materials/:id', adminAuth, (req, res) => {
    const { type, title, description, course, hashtags, pdf_url, video_url } = req.body;
    const sql = `
        UPDATE materials
        SET type = COALESCE(?, type),
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            course = COALESCE(?, course),
            hashtags = COALESCE(?, hashtags),
            pdf_url = COALESCE(?, pdf_url),
            video_url = COALESCE(?, video_url)
        WHERE id = ?
    `;
    db.run(sql, [type, title, description, course, hashtags, pdf_url, video_url, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Материал не найден' });
        res.json({ success: true });
    });
});

app.delete('/api/materials/:id', adminAuth, (req, res) => {
    db.run('DELETE FROM materials WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Материал не найден' });
        res.json({ success: true });
    });
});

app.post('/api/tests', adminAuth, (req, res) => {
    const { topic, title, description, material_id } = req.body;
    if (!topic || !title) {
        return res.status(400).json({ error: 'topic и title обязательны' });
    }
    const sql = `INSERT INTO tests (topic, title, description, material_id) VALUES (?, ?, ?, ?)`;
    db.run(sql, [topic, title, description, material_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID });
    });
});

app.post('/api/questions', adminAuth, (req, res) => {
    const { test_id, question_text, options, correct_option_index } = req.body;
    if (!test_id || !question_text || !options || correct_option_index === undefined) {
        return res.status(400).json({ error: 'Не все поля заполнены' });
    }
    const sql = `
        INSERT INTO questions (test_id, question_text, options, correct_option_index)
        VALUES (?, ?, ?, ?)
    `;
    db.run(sql, [test_id, question_text, JSON.stringify(options), correct_option_index], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID });
    });
});

app.post('/api/upload', adminAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// ---------- Обработчики бота (команды) ----------

// Администраторы
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
function isAdmin(ctx) {
    return ADMIN_IDS.includes(ctx.from.id);
}

// ---------- Сессия ----------
bot.use(session());

// ---------- Логирование (для отладки) ----------
bot.use((ctx, next) => {
    if (ctx.message) {
        console.log(`📩 Получено сообщение от ${ctx.from.id}: ${ctx.message.text || '(не текст)'}`);
    }
    return next();
});

// ---------- Команды бота ----------
bot.start((ctx) => {
    ctx.reply(
        `📚 Добро пожаловать в Онлайн Школу Помощь!\n\n` +
        `Нажмите кнопку ниже, чтобы открыть библиотеку материалов.`,
        {
            reply_markup: {
                keyboard: [
                    [{ text: '📖 Открыть библиотеку', web_app: { url: process.env.APP_URL || 'http://localhost:3000' } }]
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            }
        }
    );
});

bot.command('admin', (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ У вас нет прав администратора.');
    ctx.reply(
        `👑 Административная панель:\n` +
        `/add_material - добавить новый материал\n` +
        `/add_test - добавить тест\n` +
        `/add_question - добавить вопрос к тесту\n` +
        `/list_materials - список материалов (ID, название)\n` +
        `/list_tests - список тестов (ID, название)`
    );
});

// ---------- Обработчики диалогов ----------
bot.use(async (ctx, next) => {
    if (!ctx.message || !ctx.message.text) return next();
    const text = ctx.message.text.trim();
    const state = ctx.session.state;
    if (!state || !state.step) return next();

    const handlers = {
        'add_material': async (ctx, text) => {
            const state = ctx.session.state;
            if (!state) return;
            switch (state.currentStep) {
                case 0:
                    state.type = text;
                    state.currentStep = 1;
                    await ctx.reply('Введите заголовок материала:');
                    break;
                case 1:
                    state.title = text;
                    state.currentStep = 2;
                    await ctx.reply('Введите описание (или отправьте "пропустить"):');
                    break;
                case 2:
                    state.description = text === 'пропустить' ? '' : text;
                    state.currentStep = 3;
                    await ctx.reply('Введите название предмета (курса), например "фармакология":');
                    break;
                case 3:
                    state.course = text;
                    state.currentStep = 4;
                    await ctx.reply('Введите хештеги через запятую (например, "фармакология,антибиотики"):');
                    break;
                case 4:
                    state.hashtags = text;
                    state.currentStep = 5;
                    await ctx.reply('Введите ссылку на PDF (или отправьте "пропустить"):');
                    break;
                case 5:
                    state.pdf_url = text === 'пропустить' ? '' : text;
                    state.currentStep = 6;
                    await ctx.reply('Введите ссылку на видео (или отправьте "пропустить"):');
                    break;
                case 6:
                    state.video_url = text === 'пропустить' ? '' : text;
                    const { type, title, description, course, hashtags, pdf_url, video_url } = state;
                    const sql = `
                        INSERT INTO materials (type, title, description, course, hashtags, pdf_url, video_url)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;
                    db.run(sql, [type, title, description, course, hashtags, pdf_url, video_url], function(err) {
                        if (err) {
                            console.error(err);
                            ctx.reply('❌ Ошибка при добавлении материала.');
                        } else {
                            ctx.reply(`✅ Материал добавлен! ID: ${this.lastID}`);
                        }
                    });
                    delete ctx.session.state;
                    break;
                default:
                    delete ctx.session.state;
                    ctx.reply('Диалог отменён.');
            }
        },
        'add_test': async (ctx, text) => {
            const state = ctx.session.state;
            if (!state) return;
            switch (state.currentStep) {
                case 0:
                    state.topic = text;
                    state.currentStep = 1;
                    await ctx.reply('Введите заголовок теста:');
                    break;
                case 1:
                    state.title = text;
                    state.currentStep = 2;
                    await ctx.reply('Введите описание (или "пропустить"):');
                    break;
                case 2:
                    state.description = text === 'пропустить' ? '' : text;
                    state.currentStep = 3;
                    await ctx.reply('Введите ID материала, к которому привязать тест (или 0, если без привязки):');
                    break;
                case 3:
                    const material_id = parseInt(text);
                    state.material_id = isNaN(material_id) ? null : material_id;
                    const { topic, title, description, material_id: mid } = state;
                    const sql = `INSERT INTO tests (topic, title, description, material_id) VALUES (?, ?, ?, ?)`;
                    db.run(sql, [topic, title, description, mid], function(err) {
                        if (err) {
                            console.error(err);
                            ctx.reply('❌ Ошибка при добавлении теста.');
                        } else {
                            ctx.reply(`✅ Тест добавлен! ID: ${this.lastID}. Теперь можете добавить вопросы через /add_question`);
                        }
                    });
                    delete ctx.session.state;
                    break;
                default:
                    delete ctx.session.state;
                    ctx.reply('Диалог отменён.');
            }
        },
        'add_question': async (ctx, text) => {
            const state = ctx.session.state;
            if (!state) return;
            switch (state.currentStep) {
                case 0:
                    const test_id = parseInt(text);
                    if (isNaN(test_id)) {
                        await ctx.reply('❌ Введите корректный ID теста (число).');
                        return;
                    }
                    state.test_id = test_id;
                    state.currentStep = 1;
                    await ctx.reply('Введите текст вопроса:');
                    break;
                case 1:
                    state.question_text = text;
                    state.currentStep = 2;
                    await ctx.reply('Введите варианты ответов через запятую (например: "Вариант1, Вариант2, Вариант3"):');
                    break;
                case 2:
                    const options = text.split(',').map(s => s.trim());
                    if (options.length < 2) {
                        await ctx.reply('❌ Должно быть минимум 2 варианта. Попробуйте снова /add_question');
                        delete ctx.session.state;
                        return;
                    }
                    state.options = options;
                    state.currentStep = 3;
                    await ctx.reply(`Введите индекс правильного ответа (от 0 до ${options.length - 1}):`);
                    break;
                case 3:
                    const correct = parseInt(text);
                    if (isNaN(correct) || correct < 0 || correct >= state.options.length) {
                        await ctx.reply(`❌ Индекс должен быть от 0 до ${state.options.length - 1}. Попробуйте снова /add_question`);
                        delete ctx.session.state;
                        return;
                    }
                    state.correct_option_index = correct;
                    const { test_id: tid, question_text, options: opts, correct_option_index } = state;
                    const sql = `
                        INSERT INTO questions (test_id, question_text, options, correct_option_index)
                        VALUES (?, ?, ?, ?)
                    `;
                    db.run(sql, [tid, question_text, JSON.stringify(opts), correct_option_index], function(err) {
                        if (err) {
                            console.error(err);
                            ctx.reply('❌ Ошибка при добавлении вопроса.');
                        } else {
                            ctx.reply(`✅ Вопрос добавлен! ID: ${this.lastID}`);
                        }
                    });
                    delete ctx.session.state;
                    break;
                default:
                    delete ctx.session.state;
                    ctx.reply('Диалог отменён.');
            }
        }
    };

    const handler = handlers[state.step];
    if (handler) {
        try {
            await handler(ctx, text);
        } catch (err) {
            console.error('Ошибка в диалоге:', err);
            ctx.reply('❌ Произошла ошибка. Попробуйте снова.');
        }
    } else {
        delete ctx.session.state;
        ctx.reply('Диалог отменён.');
    }
});

bot.command('add_material', (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Нет прав.');
    if (!ctx.session) ctx.session = {};
    ctx.session.state = { step: 'add_material', currentStep: 0 };
    ctx.reply('Введите тип материала (конспект, видео, реферат, комплекс, тест):');
});

bot.command('add_test', (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Нет прав.');
    if (!ctx.session) ctx.session = {};
    ctx.session.state = { step: 'add_test', currentStep: 0 };
    ctx.reply('Введите тему теста (topic):');
});

bot.command('add_question', (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Нет прав.');
    if (!ctx.session) ctx.session = {};
    ctx.session.state = { step: 'add_question', currentStep: 0 };
    ctx.reply('Введите ID теста, к которому добавить вопрос:');
});

bot.command('list_materials', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Нет прав.');
    db.all('SELECT * FROM materials ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error(err);
            ctx.reply('❌ Ошибка получения списка.');
            return;
        }
        if (rows.length === 0) {
            ctx.reply('Нет материалов.');
            return;
        }
        let msg = '📚 Список материалов:\n';
        rows.forEach(m => {
            msg += `ID: ${m.id} | ${m.title} (${m.type})\n`;
        });
        ctx.reply(msg);
    });
});

bot.command('list_tests', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Нет прав.');
    db.all('SELECT * FROM tests ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error(err);
            ctx.reply('❌ Ошибка получения списка.');
            return;
        }
        if (rows.length === 0) {
            ctx.reply('Нет тестов.');
            return;
        }
        let msg = '📝 Список тестов:\n';
        rows.forEach(t => {
            msg += `ID: ${t.id} | ${t.title} (topic: ${t.topic})\n`;
        });
        ctx.reply(msg);
    });
});

bot.on('document', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Нет прав.');
    const file = ctx.message.document;
    if (!file.mime_type.includes('pdf')) {
        return ctx.reply('Пожалуйста, загрузите PDF-файл.');
    }
    try {
        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        const fileResponse = await axios.get(fileLink, { responseType: 'stream' });
        const formData = new FormData();
        formData.append('file', fileResponse.data, file.file_name);

        const uploadRes = await axios.post(`${process.env.APP_URL || 'http://localhost:3000'}/api/upload`, formData, {
            headers: {
                ...formData.getHeaders(),
                'x-admin-token': ADMIN_TOKEN
            }
        });
        const pdfUrl = uploadRes.data.url;
        await ctx.reply(`✅ Файл загружен. Ссылка: ${pdfUrl}`);
    } catch (err) {
        console.error(err);
        ctx.reply('❌ Ошибка загрузки файла.');
    }
});


// Логирование всех запросов к /webhook
app.use('/webhook', (req, res, next) => {
    console.log('📨 Получен запрос на /webhook');
    console.log('Body:', req.body);
    next();
});

// ---------- Webhook для бота ----------
app.use('/webhook', bot.webhookCallback('/webhook'));

// ---------- Запуск сервера ----------
let isBotRunning = false;

app.listen(PORT, async () => {
    console.log(`✅ Сервер запущен на http://localhost:${PORT}`);

    if (process.env.NODE_ENV === 'production') {
        const webhookUrl = `${process.env.APP_URL}/webhook`;
        try {
            await bot.telegram.setWebhook(webhookUrl);
            console.log(`✅ Webhook установлен на ${webhookUrl}`);
        } catch (err) {
            console.error('❌ Ошибка установки webhook:', err);
        }
        // В режиме webhook бот не запускается через launch()
    } else {
        await bot.launch();
        isBotRunning = true;
        console.log('🤖 Бот запущен в режиме Long Polling (для разработки)');
    }
});