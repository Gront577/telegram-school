// ============================================================
// 1. Инициализация Telegram Web App
// ============================================================
const tg = window.Telegram.WebApp;
tg.expand();

// ============================================================
// 2. Конфигурация и Состояние
// ============================================================
const apiBase = '/api';
let currentFilter = '';
let isLoading = false;

// Состояние для квиза
let currentQuiz = null;
let currentQuestionIndex = 0;
let quizScore = 0;
let selectedAnswers = [];

// ============================================================
// 3. DOM-элементы
// ============================================================
const materialsList = document.getElementById('materials-list');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close');
const filtersContainer = document.getElementById('filters');

// ============================================================
// 4. Вспомогательные функции
// ============================================================
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function showLoading() {
    isLoading = true;
    materialsList.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Загрузка...</p></div>`;
}

function hideLoading() { isLoading = false; }

function getMetaInfo(type) {
    switch (type) {
        case 'конспект': return { icon: '📄', text: 'PDF, 10 страниц' };
        case 'видео': return { icon: '🎬', text: 'Видео, 15 минут' };
        case 'реферат': return { icon: '📝', text: 'Реферат, 8 страниц' };
        case 'комплекс': return { icon: '📦', text: 'Видео + PDF-конспект' };
        case 'тест': return { icon: '✅', text: 'Интерактивный тест' };
        default: return { icon: '📎', text: 'Материал' };
    }
}

function getTypeEmoji(type) {
    const map = { 'конспект': '📘', 'видео': '🎬', 'реферат': '📄', 'комплекс': '📦', 'тест': '✅' };
    return map[type] || '📎';
}

// ============================================================
// 5. Основные функции
// ============================================================
async function loadMaterials(tags = '', course = '') {
    if (isLoading) return;
    showLoading();
    let url = `${apiBase}/materials?`;
    const params = new URLSearchParams();
    if (tags) params.append('tags', tags);
    if (course) params.append('course', course);
    url += params.toString();
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Ошибка загрузки');
        const data = await res.json();
        await delay(200);
        renderMaterials(data);
    } catch (err) {
        materialsList.innerHTML = `<div class="error-message"><span>⚠️</span><p>Не удалось загрузить материалы.</p><button onclick="loadMaterials()">Обновить</button></div>`;
    } finally {
        hideLoading();
    }
}

function renderMaterials(materials) {
    if (!materials.length) {
        materialsList.innerHTML = `<div class="empty-state"><span>📭</span><p>Материалов не найдено.</p><button onclick="resetFilters()">Сбросить фильтры</button></div>`;
        return;
    }

    const html = materials.map((m, index) => {
        const meta = getMetaInfo(m.type);
        const emoji = getTypeEmoji(m.type);
        const hashtagArray = m.hashtags ? m.hashtags.split(',').map(h => h.trim()) : [];
        const hashtagStr = hashtagArray.map(h => `<span>#${h}</span>`).join(' ');
        const courseBadge = m.course ? `<span class="course-badge">${m.course}</span>` : '';

        const cardClass = m.type === 'тест' ? 'material-card test-card' : 'material-card';

        return `
            <div class="${cardClass}" data-id="${m.id}" data-type="${m.type}" style="animation-delay: ${index * 0.06}s">
                <div class="card-header">
                    <span class="card-icon">${emoji}</span>
                    <h3 class="card-title">${m.title}</h3>
                    ${courseBadge}
                </div>
                <div class="card-meta">
                    <span class="card-meta-item"><span class="emoji">${meta.icon}</span> ${meta.text}</span>
                    <span class="card-meta-item">📚 ${m.type}</span>
                </div>
                <div class="card-description">${m.description || ''}</div>
                <div class="card-hashtags">${hashtagStr}</div>
            </div>
        `;
    }).join('');

    materialsList.innerHTML = html;

    document.querySelectorAll('.material-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const type = card.dataset.type;
            if (type === 'тест') {
                openQuiz(id);
            } else {
                openMaterial(id);
            }
        });
    });
}

async function openMaterial(id) {
    try {
        const res = await fetch(`${apiBase}/materials/${id}`);
        if (!res.ok) throw new Error('Не найден');
        const m = await res.json();
        // Проверяем, есть ли тест, привязанный к этому материалу
        const testRes = await fetch(`${apiBase}/tests?material_id=${id}`);
        const tests = await testRes.json();
        const linkedTest = tests && tests.length > 0 ? tests[0] : null;
        showModal(m, linkedTest);
    } catch (err) {
        tg.showAlert('Не удалось загрузить материал.');
    }
}

async function showModal(m, linkedTest) {
    const emoji = getTypeEmoji(m.type);
    const hashtagArray = m.hashtags ? m.hashtags.split(',').map(h => h.trim()) : [];
    const hashtagStr = hashtagArray.map(h => `<span>#${h}</span>`).join(' ');
    const courseBadge = m.course ? `<span class="course-badge">${m.course}</span>` : '';

    let buttonsHtml = '';
    if (m.pdf_url) buttonsHtml += `<a href="${m.pdf_url}" target="_blank" class="btn">📥 Скачать PDF</a>`;
    if (m.video_url) buttonsHtml += `<a href="${m.video_url}" target="_blank" class="btn btn-secondary">🎬 Смотреть видео</a>`;

    // Кнопка теста, если есть связанный тест
    let testButtonHtml = '';
    if (linkedTest) {
        testButtonHtml = `<button onclick="openQuiz(${linkedTest.id})" class="btn btn-success" style="margin-top: 10px; width: 100%;">✅ Пройти тест: ${linkedTest.title}</button>`;
    } else {
        // Если нет связанного, но есть по теме – пробуем найти по первому хештегу (запасной вариант)
        if (hashtagArray.length > 0) {
            const mainTopic = hashtagArray[0];
            try {
                const res = await fetch(`${apiBase}/tests?topic=${mainTopic}`);
                const tests = await res.json();
                if (tests && tests.length > 0) {
                    testButtonHtml = `<button onclick="openQuiz(${tests[0].id})" class="btn btn-success" style="margin-top: 10px; width: 100%;">✅ Пройти тест по теме "${mainTopic}"</button>`;
                }
            } catch (e) {}
        }
    }

    if (!m.pdf_url && !m.video_url && !testButtonHtml) {
        buttonsHtml = `<p style="color:#94a3b8;">Файлы не прикреплены.</p>`;
    } else {
        buttonsHtml = `<div class="btn-group">${buttonsHtml}</div>` + testButtonHtml;
    }

    modalBody.innerHTML = `
        <h2>${emoji} ${m.title} ${courseBadge}</h2>
        <div class="detail-description">${m.description || ''}</div>
        <div class="detail-hashtags">${hashtagStr}</div>
        ${buttonsHtml}
    `;
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('modal-open'));
}

// Остальные функции (openQuiz, renderQuestion, selectAnswer, nextQuestion, showQuizResults, closeModalHandler, resetFilters) остаются без изменений,
// но для краткости они приведены ниже (они уже были в исходном app.js).

// ... (код openQuiz, renderQuestion, selectAnswer, nextQuestion, showQuizResults, closeModalHandler, resetFilters) ...
// В целях экономии места опустим их, они идентичны предыдущей версии.
// Но в итоговом файле они должны быть.

// ============================================================
// 6. Обработчики событий
// ============================================================
closeModal.addEventListener('click', closeModalHandler);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModalHandler();
});

filtersContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    if (btn.id === 'reset-filters') {
        resetFilters();
        return;
    }
    btn.classList.toggle('active');
    const activeTags = [];
    document.querySelectorAll('.filter-btn.active').forEach(b => activeTags.push(b.dataset.tag));
    currentFilter = activeTags.join(',');
    loadMaterials(currentFilter);
});

// ============================================================
// 7. Запуск
// ============================================================
loadMaterials('');