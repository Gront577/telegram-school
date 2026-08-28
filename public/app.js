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
const filterSlider = document.getElementById('filter-slider');

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

// ---------- Ripple-эффект ----------
function createRipple(e, element) {
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    element.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

// ---------- Управление слайдером фильтров ----------
function updateSlider(activeChip) {
    if (!activeChip) {
        filterSlider.style.width = '0';
        filterSlider.style.left = '0';
        return;
    }
    const wrapper = document.getElementById('filters-wrapper');
    const wrapperRect = wrapper.getBoundingClientRect();
    const chipRect = activeChip.getBoundingClientRect();
    const left = chipRect.left - wrapperRect.left + wrapper.scrollLeft;
    const width = chipRect.width;
    filterSlider.style.left = left + 'px';
    filterSlider.style.width = width + 'px';
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
        console.error('Ошибка загрузки материалов:', err);
        materialsList.innerHTML = `
            <div class="error-message">
                <span>⚠️</span>
                <p>Не удалось загрузить материалы.</p>
                <button onclick="loadMaterials()">Обновить</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

function renderMaterials(materials) {
    console.log('🔄 Рендеринг материалов, количество:', materials.length);
    if (!materials || materials.length === 0) {
        materialsList.innerHTML = `
            <div class="empty-state">
                <span>📭</span>
                <p>Материалов не найдено.</p>
                <button onclick="resetFilters()">Сбросить фильтры</button>
            </div>
        `;
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

    // Плавная смена: сначала убираем старые карточки с анимацией
    const oldCards = materialsList.querySelectorAll('.material-card');
    if (oldCards.length) {
        oldCards.forEach(card => card.classList.add('filtering-out'));
        setTimeout(() => {
            materialsList.innerHTML = html;
            // Добавляем класс filtering-in для появления
            materialsList.querySelectorAll('.material-card').forEach((card, i) => {
                card.style.animationDelay = (i * 0.06) + 's';
                card.classList.add('filtering-in');
            });
        }, 300);
    } else {
        materialsList.innerHTML = html;
        materialsList.querySelectorAll('.material-card').forEach((card, i) => {
            card.style.animationDelay = (i * 0.06) + 's';
        });
    }

    // Навешиваем обработчики кликов
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
        const testRes = await fetch(`${apiBase}/tests?material_id=${id}`);
        const tests = await testRes.json();
        const linkedTest = tests && tests.length > 0 ? tests[0] : null;
        showModal(m, linkedTest);
    } catch (err) {
        console.error('Ошибка открытия материала:', err);
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

    let testButtonHtml = '';
    if (linkedTest) {
        testButtonHtml = `<button onclick="openQuiz(${linkedTest.id})" class="btn btn-success" style="margin-top: 10px; width: 100%;">✅ Пройти тест: ${linkedTest.title}</button>`;
    } else if (hashtagArray.length > 0) {
        const mainTopic = hashtagArray[0];
        try {
            const res = await fetch(`${apiBase}/tests?topic=${mainTopic}`);
            const tests = await res.json();
            if (tests && tests.length > 0) {
                testButtonHtml = `<button onclick="openQuiz(${tests[0].id})" class="btn btn-success" style="margin-top: 10px; width: 100%;">✅ Пройти тест по теме "${mainTopic}"</button>`;
            }
        } catch (e) {}
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

// ---------- Квиз ----------
async function openQuiz(testId) {
    try {
        const res = await fetch(`${apiBase}/tests/${testId}`);
        if (!res.ok) throw new Error('Тест не найден');
        currentQuiz = await res.json();
        currentQuestionIndex = 0;
        quizScore = 0;
        selectedAnswers = [];
        renderQuestion();
        modal.style.display = 'flex';
        requestAnimationFrame(() => modal.classList.add('modal-open'));
    } catch (err) {
        console.error('Ошибка загрузки теста:', err);
        tg.showAlert('Не удалось загрузить тест.');
    }
}

function renderQuestion() {
    if (!currentQuiz || currentQuestionIndex >= currentQuiz.questions.length) {
        showQuizResults();
        return;
    }

    const q = currentQuiz.questions[currentQuestionIndex];
    const progress = Math.round(((currentQuestionIndex) / currentQuiz.questions.length) * 100);

    const optionsHtml = q.options.map((opt, idx) => `
        <div class="quiz-option" onclick="selectAnswer(${idx}, this)">
            <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
            <span class="option-text">${opt}</span>
        </div>
    `).join('');

    modalBody.innerHTML = `
        <div class="quiz-header">
            <h3>${currentQuiz.title}</h3>
            <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>
            <p class="question-counter">Вопрос ${currentQuestionIndex + 1} из ${currentQuiz.questions.length}</p>
        </div>
        <div class="quiz-question">
            <p>${q.question_text}</p>
        </div>
        <div class="quiz-options">
            ${optionsHtml}
        </div>
        <button id="next-question-btn" class="btn btn-success" style="width: 100%; margin-top: 20px; display: none;" onclick="nextQuestion()">
            ${currentQuestionIndex === currentQuiz.questions.length - 1 ? 'Завершить тест' : 'Следующий вопрос'}
        </button>
    `;
}

window.selectAnswer = function(selectedIndex, element) {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    document.querySelectorAll('.quiz-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.style.pointerEvents = 'none';
    });
    element.classList.add('selected');
    selectedAnswers[currentQuestionIndex] = selectedIndex;
    document.getElementById('next-question-btn').style.display = 'block';
};

window.nextQuestion = function() {
    const q = currentQuiz.questions[currentQuestionIndex];
    if (selectedAnswers[currentQuestionIndex] === q.correct_option_index) {
        quizScore++;
    }
    currentQuestionIndex++;
    renderQuestion();
};

function showQuizResults() {
    const total = currentQuiz.questions.length;
    const percentage = Math.round((quizScore / total) * 100);
    let message = `Вы ответили правильно на ${quizScore} из ${total} вопросов (${percentage}%).`;
    if (percentage === 100) message += '\n🎉 Отличный результат!';
    else if (percentage >= 70) message += '\n👍 Хороший результат!';
    else message += '\n📚 Стоит повторить материал.';

    modalBody.innerHTML = `
        <div class="quiz-result" style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 10px;">${percentage >= 70 ? '🏆' : '📖'}</div>
            <h2>Тест завершен!</h2>
            <p style="font-size: 18px; margin: 20px 0; white-space: pre-line;">${message}</p>
            <button onclick="closeModalHandler()" class="btn">Закрыть</button>
        </div>
    `;
    tg.showAlert(message);
}

function closeModalHandler() {
    modal.classList.remove('modal-open');
    setTimeout(() => {
        modal.style.display = 'none';
        currentQuiz = null;
    }, 300);
}

function resetFilters() {
    currentFilter = '';
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    // Скрываем слайдер
    filterSlider.style.width = '0';
    filterSlider.style.left = '0';
    loadMaterials('');
    materialsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
// 6. Обработчики событий
// ============================================================
closeModal.addEventListener('click', closeModalHandler);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModalHandler();
});

filtersContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;

    // Ripple-эффект
    createRipple(e, chip);

    if (chip.id === 'reset-filters') {
        resetFilters();
        return;
    }

    // Переключение активности
    const wasActive = chip.classList.contains('active');
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if (!wasActive) {
        chip.classList.add('active');
    }
    // Обновляем слайдер
    const activeChip = document.querySelector('.filter-chip.active');
    updateSlider(activeChip);

    const activeTags = [];
    document.querySelectorAll('.filter-chip.active').forEach(c => activeTags.push(c.dataset.tag));
    currentFilter = activeTags.join(',');
    loadMaterials(currentFilter);
});

// Инициализация слайдера (скрыт по умолчанию)
updateSlider(null);

// ============================================================
// 7. Запуск
// ============================================================
loadMaterials('');