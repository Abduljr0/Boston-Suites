const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, 'boston_suites.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database ' + dbPath + ': ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

db.serialize(() => {
    // 1. Room Types
    db.run(`CREATE TABLE IF NOT EXISTS room_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        base_price REAL NOT NULL,
        capacity_adults INTEGER NOT NULL,
        capacity_children INTEGER NOT NULL,
        features TEXT -- JSON array string
    )`);

    // 2. Rooms
    db.run(`CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        number TEXT NOT NULL,
        name TEXT,
        type TEXT NOT NULL, -- 1BR, 2BR, Suite, etc.
        beds INTEGER DEFAULT 1,
        price REAL NOT NULL,
        description TEXT,
        image_url TEXT,
        status TEXT DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 3. Clients
    db.run(`CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 4. Bookings
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        check_in DATE NOT NULL,
        check_out DATE NOT NULL,
        status TEXT DEFAULT 'RESERVED', -- RESERVED, CHECKED_IN, CHECKED_OUT, CANCELLED
        total_amount REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id),
        FOREIGN KEY (client_id) REFERENCES clients(id)
    )`);

    // Indices for performance on date ranges (Phase 6)
    db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`);

    // Seed Data (if empty)
    db.get("SELECT count(*) as count FROM room_types", (err, row) => {
        if (row.count === 0) {
            console.log("Seeding Database...");
            const stmt = db.prepare("INSERT INTO room_types VALUES (?, ?, ?, ?, ?, ?)");
            stmt.run("rt_luxury", "Luxury Suite", 250.00, 2, 1, JSON.stringify(["Ocean View", "King Bed"]));
            stmt.run("rt_double", "Double Room", 120.00, 2, 2, JSON.stringify(["City View", "2 Queen Beds"]));
            stmt.run("rt_single", "Single Room", 80.00, 1, 0, JSON.stringify(["Standard", "Single Bed"]));
            stmt.finalize();

            const roomStmt = db.prepare("INSERT INTO rooms (id, number, name, type, beds, price, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            // Luxury
            roomStmt.run(uuidv4(), "101", "Ocean Breeze Suite", "Suite", 1, 250.00, "Stunning ocean view with king bed", "ACTIVE");
            roomStmt.run(uuidv4(), "104", "Garden Serenity", "Suite", 1, 230.00, "Quiet garden view with luxury amenities", "ACTIVE");
            // Double
            roomStmt.run(uuidv4(), "205", "City Light Double", "Double", 2, 150.00, "Two queen beds with city view", "ACTIVE");
            roomStmt.run(uuidv4(), "206", "Standard Double", "Double", 2, 130.00, "Comfortable stay for small families", "INACTIVE");
            // Single
            roomStmt.run(uuidv4(), "301", "Solo Traveler", "Single", 1, 90.00, "Perfect for business trips", "ACTIVE");
            roomStmt.run(uuidv4(), "302", "Economy Single", "Single", 1, 75.00, "Budget friendly option", "ACTIVE");
            roomStmt.finalize();
        }
    });
});

module.exports = db;
