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
// 4. Кастомизация персонажа (SVG + редактор)
// ============================================================
const CHARACTER_STORAGE_KEY = 'character_data';

const defaultCharacter = {
    skin: '#f5d0b0',
    eyes: '#333333',
    hair: 'straight_dark',
    glasses: 'none',
    hat: 'none',
    facial_hair: 'none'
};

const options = {
    skin: [
        { value: '#f5d0b0', label: 'Светлая' },
        { value: '#e8c09a', label: 'Средняя' },
        { value: '#d4a67a', label: 'Тёмная' },
        { value: '#f0c8a0', label: 'Румяная' }
    ],
    hair: [
        { value: 'straight_dark', label: 'Тёмные прямые' },
        { value: 'straight_light', label: 'Светлые прямые' },
        { value: 'curly_dark', label: 'Тёмные кудрявые' },
        { value: 'curly_light', label: 'Светлые кудрявые' },
        { value: 'none', label: 'Без волос' }
    ],
    glasses: [
        { value: 'none', label: 'Без очков' },
        { value: 'round', label: 'Круглые' },
        { value: 'square', label: 'Квадратные' },
        { value: 'sunglasses', label: 'Солнцезащитные' }
    ],
    hat: [
        { value: 'none', label: 'Без шляпы' },
        { value: 'top_hat', label: 'Цилиндр' },
        { value: 'beanie', label: 'Шапка' },
        { value: 'cap', label: 'Кепка' },
        { value: 'cowboy', label: 'Ковбойская' }
    ],
    facial_hair: [
        { value: 'none', label: 'Без усов' },
        { value: 'mustache', label: 'Усы' },
        { value: 'beard', label: 'Борода' },
        { value: 'goatee', label: 'Козлиная бородка' }
    ]
};

function generateCharacterSVG(data) {
    const skin = data.skin || defaultCharacter.skin;
    const eyes = data.eyes || defaultCharacter.eyes;
    const hair = data.hair || defaultCharacter.hair;
    const glasses = data.glasses || defaultCharacter.glasses;
    const hat = data.hat || defaultCharacter.hat;
    const facial_hair = data.facial_hair || defaultCharacter.facial_hair;

    let svg = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:100%;">`;
    // Лицо
    svg += `<circle cx="100" cy="110" r="60" fill="${skin}" stroke="#d4a67a" stroke-width="2"/>`;
    // Глаза
    svg += `<ellipse cx="75" cy="100" rx="10" ry="12" fill="${eyes}"/>`;
    svg += `<ellipse cx="125" cy="100" rx="10" ry="12" fill="${eyes}"/>`;
    svg += `<ellipse cx="78" cy="98" rx="4" ry="6" fill="white"/>`;
    svg += `<ellipse cx="128" cy="98" rx="4" ry="6" fill="white"/>`;
    // Рот
    svg += `<path d="M 80 130 Q 100 145 120 130" stroke="#c0392b" stroke-width="3" fill="none" stroke-linecap="round"/>`;

    // Волосы
    if (hair !== 'none') {
        if (hair === 'straight_dark') {
            svg += `<path d="M 40 110 Q 30 60 70 50 Q 100 40 130 50 Q 170 60 160 110" fill="#3d2b1f" stroke="#2d1f15" stroke-width="2"/>`;
        } else if (hair === 'straight_light') {
            svg += `<path d="M 40 110 Q 30 60 70 50 Q 100 40 130 50 Q 170 60 160 110" fill="#d4a373" stroke="#b8895a" stroke-width="2"/>`;
        } else if (hair === 'curly_dark') {
            svg += `<circle cx="50" cy="60" r="25" fill="#3d2b1f"/>`;
            svg += `<circle cx="85" cy="45" r="25" fill="#3d2b1f"/>`;
            svg += `<circle cx="120" cy="45" r="25" fill="#3d2b1f"/>`;
            svg += `<circle cx="150" cy="60" r="25" fill="#3d2b1f"/>`;
            svg += `<circle cx="70" cy="35" r="20" fill="#3d2b1f"/>`;
            svg += `<circle cx="100" cy="30" r="20" fill="#3d2b1f"/>`;
            svg += `<circle cx="130" cy="35" r="20" fill="#3d2b1f"/>`;
        } else if (hair === 'curly_light') {
            svg += `<circle cx="50" cy="60" r="25" fill="#d4a373"/>`;
            svg += `<circle cx="85" cy="45" r="25" fill="#d4a373"/>`;
            svg += `<circle cx="120" cy="45" r="25" fill="#d4a373"/>`;
            svg += `<circle cx="150" cy="60" r="25" fill="#d4a373"/>`;
            svg += `<circle cx="70" cy="35" r="20" fill="#d4a373"/>`;
            svg += `<circle cx="100" cy="30" r="20" fill="#d4a373"/>`;
            svg += `<circle cx="130" cy="35" r="20" fill="#d4a373"/>`;
        }
    }

    // Очки
    if (glasses !== 'none') {
        if (glasses === 'round') {
            svg += `<circle cx="75" cy="100" r="16" fill="none" stroke="#555" stroke-width="3"/>`;
            svg += `<circle cx="125" cy="100" r="16" fill="none" stroke="#555" stroke-width="3"/>`;
            svg += `<line x1="91" y1="100" x2="109" y2="100" stroke="#555" stroke-width="3"/>`;
        } else if (glasses === 'square') {
            svg += `<rect x="59" y="84" width="32" height="32" rx="4" fill="none" stroke="#555" stroke-width="3"/>`;
            svg += `<rect x="109" y="84" width="32" height="32" rx="4" fill="none" stroke="#555" stroke-width="3"/>`;
            svg += `<line x1="91" y1="100" x2="109" y2="100" stroke="#555" stroke-width="3"/>`;
        } else if (glasses === 'sunglasses') {
            svg += `<rect x="55" y="85" width="90" height="30" rx="6" fill="#222" opacity="0.8"/>`;
            svg += `<line x1="100" y1="85" x2="100" y2="115" stroke="#555" stroke-width="2"/>`;
        }
    }

    // Шляпа
    if (hat !== 'none') {
        if (hat === 'top_hat') {
            svg += `<rect x="70" y="30" width="60" height="40" rx="4" fill="#2d2d2d"/>`;
            svg += `<rect x="60" y="70" width="80" height="10" rx="2" fill="#2d2d2d"/>`;
        } else if (hat === 'beanie') {
            svg += `<ellipse cx="100" cy="50" rx="45" ry="25" fill="#e74c3c"/>`;
            svg += `<circle cx="100" cy="30" r="10" fill="#e74c3c"/>`;
        } else if (hat === 'cap') {
            svg += `<path d="M 50 70 Q 100 40 150 70 L 150 75 L 50 75 Z" fill="#3498db"/>`;
            svg += `<rect x="45" y="70" width="10" height="15" rx="2" fill="#3498db"/>`;
        } else if (hat === 'cowboy') {
            svg += `<path d="M 40 70 Q 100 30 160 70 L 170 80 L 30 80 Z" fill="#8B4513"/>`;
            svg += `<path d="M 80 60 Q 100 45 120 60" fill="none" stroke="#5a2d0c" stroke-width="2"/>`;
        }
    }

    // Усы/борода
    if (facial_hair !== 'none') {
        if (facial_hair === 'mustache') {
            svg += `<path d="M 70 125 Q 100 145 130 125" fill="none" stroke="#5a3d2b" stroke-width="4" stroke-linecap="round"/>`;
        } else if (facial_hair === 'beard') {
            svg += `<path d="M 65 130 Q 100 175 135 130" fill="#5a3d2b" stroke="#3d2b1f" stroke-width="2"/>`;
        } else if (facial_hair === 'goatee') {
            svg += `<path d="M 85 130 Q 100 155 115 130" fill="#5a3d2b" stroke="#3d2b1f" stroke-width="2"/>`;
        }
    }

    svg += `</svg>`;
    return svg;
}

function loadCharacter() {
    try {
        const stored = localStorage.getItem(CHARACTER_STORAGE_KEY);
        return stored ? JSON.parse(stored) : { ...defaultCharacter };
    } catch {
        return { ...defaultCharacter };
    }
}

function saveCharacter(data) {
    localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(data));
}

function renderAvatar() {
    const data = loadCharacter();
    const el = document.getElementById('avatar');
    if (el) {
        el.innerHTML = generateCharacterSVG(data);
        el.style.background = 'none';
        el.style.width = '48px';
        el.style.height = '48px';
        el.style.borderRadius = '50%';
        el.style.overflow = 'hidden';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)';
        el.style.border = '2px solid rgba(255,255,255,0.1)';
    }
}

function openCharacterEditor() {
    const data = loadCharacter();

    function renderEditor() {
        let html = `
            <div class="character-editor">
                <h2 style="text-align:center; margin-bottom:16px;">🎨 Редактор персонажа</h2>
                <div class="character-preview-wrapper" style="position:relative; width:150px; height:150px; margin:0 auto 20px;">
                    <div id="character-preview" style="width:100%; height:100%; transition: opacity 0.3s ease, transform 0.3s ease;">
                        ${generateCharacterSVG(data)}
                    </div>
                </div>
        `;

        const categoryNames = {
            skin: '',
            hair: 'Волосы',
            glasses: 'Очки',
            hat: 'Шляпа',
            facial_hair: 'Усы/борода'
        };

        Object.keys(categoryNames).forEach(category => {
            const currentValue = data[category];
            const title = categoryNames[category];
            html += `<div class="editor-section">`;
            if (title) {
                html += `<div class="editor-section-title">${title}</div>`;
            }
            html += `<div class="editor-options" data-category="${category}">`;

            options[category].forEach(opt => {
                const active = opt.value === currentValue ? 'active' : '';
                let style = '';
                if (category === 'skin') {
                    style = `style="background:${opt.value}; border:2px solid ${opt.value};"`;
                }
                // Для skin текст не показываем (пустая строка), для остальных — opt.label
                const label = category === 'skin' ? '' : opt.label;
                html += `<button class="editor-option ${active}" data-value="${opt.value}" ${style}>${label}</button>`;
            });

            html += `</div></div>`;
        });

        html += `<button id="save-character-btn" class="btn" style="width:100%; margin-top:20px;">💾 Сохранить</button>
                </div>`;

        modalBody.innerHTML = html;
        modal.style.display = 'flex';
        requestAnimationFrame(() => modal.classList.add('modal-open'));

        document.querySelectorAll('.editor-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.closest('.editor-options').dataset.category;
                const value = btn.dataset.value;
                btn.closest('.editor-options').querySelectorAll('.editor-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                data[category] = value;
                const preview = document.getElementById('character-preview');
                if (preview) {
                    preview.style.opacity = '0.6';
                    preview.style.transform = 'scale(0.9)';
                    setTimeout(() => {
                        preview.innerHTML = generateCharacterSVG(data);
                        preview.style.opacity = '1';
                        preview.style.transform = 'scale(1)';
                    }, 150);
                }
            });
        });

        document.getElementById('save-character-btn').addEventListener('click', () => {
            saveCharacter(data);
            renderAvatar();
            closeModalHandler();
        });
    }

    renderEditor();
}

// ============================================================
// 5. Основные функции (загрузка, рендеринг, квиз и т.д.)
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

    const oldCards = materialsList.querySelectorAll('.material-card');
    if (oldCards.length) {
        oldCards.forEach(card => card.classList.add('filtering-out'));
        setTimeout(() => {
            materialsList.innerHTML = html;
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

    createRipple(e, chip);

    if (chip.id === 'reset-filters') {
        resetFilters();
        return;
    }

    const wasActive = chip.classList.contains('active');
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if (!wasActive) {
        chip.classList.add('active');
    }
    const activeChip = document.querySelector('.filter-chip.active');
    updateSlider(activeChip);

    const activeTags = [];
    document.querySelectorAll('.filter-chip.active').forEach(c => activeTags.push(c.dataset.tag));
    currentFilter = activeTags.join(',');
    loadMaterials(currentFilter);
});

// Клик по заголовку "Библиотека" → сброс фильтров
document.getElementById('library-title')?.addEventListener('click', () => {
    resetFilters();
});

// Клик по аватару → открыть редактор персонажа
document.getElementById('profile-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openCharacterEditor();
});

// Горизонтальный скролл фильтров колёсиком мыши
const filtersWrapper = document.getElementById('filters-wrapper');
if (filtersWrapper) {
    filtersWrapper.addEventListener('wheel', function(e) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();
            this.scrollLeft += e.deltaY;
        }
    }, { passive: false });
}

// Инициализация слайдера и аватара
updateSlider(null);
renderAvatar();

// ============================================================
// 7. Запуск
// ============================================================
loadMaterials('');