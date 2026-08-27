// Тестовый маршрут
app.get('/test', (req, res) => {
    res.send('✅ Server is alive!');
});

// Прямой обработчик webhook с логированием
app.post('/webhook', (req, res) => {
    console.log('📨 POST /webhook received. Body:', req.body);
    // Передаём управление Telegraf
    bot.webhookCallback('/webhook')(req, res);
});