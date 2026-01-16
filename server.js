const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'schedules.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize data file if it doesn't exist
async function initializeDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify([]));
    }
}

// Read schedules from file
async function readSchedules() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading schedules:', error);
        return [];
    }
}

// Write schedules to file
async function writeSchedules(schedules) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(schedules, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing schedules:', error);
        return false;
    }
}

// API Routes

// Get all schedules
app.get('/api/schedules', async (req, res) => {
    try {
        const schedules = await readSchedules();
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

// Add a new schedule
app.post('/api/schedules', async (req, res) => {
    try {
        const schedules = await readSchedules();
        const newSchedule = {
            id: Date.now().toString(),
            ...req.body
        };
        schedules.push(newSchedule);
        await writeSchedules(schedules);
        res.json(newSchedule);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add schedule' });
    }
});

// Update a schedule
app.put('/api/schedules/:id', async (req, res) => {
    try {
        const schedules = await readSchedules();
        const index = schedules.findIndex(s => s.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        schedules[index] = {
            id: req.params.id,
            ...req.body
        };

        await writeSchedules(schedules);
        res.json(schedules[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update schedule' });
    }
});

// Delete a schedule
app.delete('/api/schedules/:id', async (req, res) => {
    try {
        const schedules = await readSchedules();
        const filteredSchedules = schedules.filter(s => s.id !== req.params.id);

        if (schedules.length === filteredSchedules.length) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        await writeSchedules(filteredSchedules);
        res.json({ message: 'Schedule deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete schedule' });
    }
});

// Start server
async function startServer() {
    await initializeDataFile();
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`API available at http://localhost:${PORT}/api/schedules`);
    });
}

startServer();
