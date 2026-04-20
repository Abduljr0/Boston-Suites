const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');
const mpesaRoutes = require('./routes/mpesa');

const app = express();
const PORT = process.env.PORT || 5005;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces (WSL/Docker compatible)

// Middleware
app.use(cors()); // Allow all CORS for dev simplicity
app.use(bodyParser.json());

// Routes
app.use('/api/v1', apiRoutes);
app.use('/api/v1/mpesa', mpesaRoutes);

// Root Health Check
app.get('/', (req, res) => {
    res.json({
        message: "Boston Suites API is running...",
        version: "1.0.0",
        timestamp: new Date().toISOString()
    });
});

// API Health Check
app.get('/api/v1/health', (req, res) => {
    res.json({
        status: "ok",
        service: "Boston Suites API",
        environment: process.env.NODE_ENV || "development",
        uptime: process.uptime()
    });
});

// Start Server
app.listen(PORT, HOST, () => {
    console.log(`\n🚀 Boston Suites API Server`);
    console.log(`📡 Listening on: http://${HOST}:${PORT}`);
    console.log(`🔗 API Endpoints: http://localhost:${PORT}/api/v1/`);
    console.log(`💚 Health Check: http://localhost:${PORT}/api/v1/health`);
    console.log(`\n✅ Server ready for connections\n`);
});
