const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow all CORS for dev simplicity
app.use(bodyParser.json());

// Routes
app.use('/api/v1', apiRoutes);

// Health Check
app.get('/', (req, res) => {
    res.json({ message: "Boston Suites API is running..." });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`API Entpoints available at http://localhost:${PORT}/api/v1/`);
});
