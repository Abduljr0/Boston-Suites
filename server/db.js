const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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
        type_id TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE', -- ACTIVE, MAINTENANCE
        FOREIGN KEY (type_id) REFERENCES room_types(id)
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

    // Seed Data (if empty)
    db.get("SELECT count(*) as count FROM room_types", (err, row) => {
        if (row.count === 0) {
            console.log("Seeding Database...");
            const stmt = db.prepare("INSERT INTO room_types VALUES (?, ?, ?, ?, ?, ?)");
            stmt.run("rt_luxury", "Luxury Suite", 250.00, 2, 1, JSON.stringify(["Ocean View", "King Bed"]));
            stmt.run("rt_double", "Double Room", 120.00, 2, 2, JSON.stringify(["City View", "2 Queen Beds"]));
            stmt.run("rt_single", "Single Room", 80.00, 1, 0, JSON.stringify(["Standard", "Single Bed"]));
            stmt.finalize();

            const roomStmt = db.prepare("INSERT INTO rooms VALUES (?, ?, ?, ?)");
            // Luxury
            roomStmt.run("rm_101", "101", "rt_luxury", "ACTIVE");
            roomStmt.run("rm_104", "104", "rt_luxury", "ACTIVE");
            // Double
            roomStmt.run("rm_205", "205", "rt_double", "ACTIVE");
            roomStmt.run("rm_206", "206", "rt_double", "MAINTENANCE");
            // Single
            roomStmt.run("rm_301", "301", "rt_single", "ACTIVE");
            roomStmt.run("rm_302", "302", "rt_single", "ACTIVE");
            roomStmt.finalize();
        }
    });
});

module.exports = db;
