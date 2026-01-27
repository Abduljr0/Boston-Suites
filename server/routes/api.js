const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../assets/images/rooms');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// -----------------------------------------------------------------------------
// MODULE 1: Rooms Management (CRUD)
// -----------------------------------------------------------------------------

// List Rooms (with pagination support)
router.get('/rooms', (req, res) => {
    const { status, type } = req.query;
    let sql = "SELECT * FROM rooms WHERE 1=1";
    const params = [];

    if (status) {
        sql += " AND status = ?";
        params.push(status);
    }
    if (type) {
        sql += " AND type = ?";
        params.push(type);
    }

    sql += " ORDER BY created_at DESC";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

// Create Room
router.post('/rooms', upload.single('image'), (req, res) => {
    const { number, name, type, beds, price, description, status } = req.body;
    const imageUrl = req.file ? `/assets/images/rooms/${req.file.filename}` : null;

    if (!number || !type || !price) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const id = uuidv4();
    const sql = `INSERT INTO rooms (id, number, name, type, beds, price, description, image_url, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [id, number, name, type, beds, price, description, imageUrl, status || 'ACTIVE'], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.status(201).json({ success: true, data: { id, number, name, type, beds, price, description, image_url: imageUrl, status } });
    });
});

// Update Room
router.put('/rooms/:id', upload.single('image'), (req, res) => {
    const { number, name, type, beds, price, description, status } = req.body;
    const id = req.params.id;

    let sql = `UPDATE rooms SET number = ?, name = ?, type = ?, beds = ?, price = ?, description = ?, status = ?`;
    const params = [number, name, type, beds, price, description, status];

    if (req.file) {
        const imageUrl = `/assets/images/rooms/${req.file.filename}`;
        sql += `, image_url = ?`;
        params.push(imageUrl);
    }

    sql += ` WHERE id = ?`;
    params.push(id);

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (this.changes === 0) return res.status(404).json({ success: false, error: "Room not found" });
        res.json({ success: true, message: "Room updated successfully" });
    });
});

// Delete Room
router.delete('/rooms/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM rooms WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (this.changes === 0) return res.status(404).json({ success: false, error: "Room not found" });
        res.json({ success: true, message: "Room deleted successfully" });
    });
});

// -----------------------------------------------------------------------------
// MODULE 2: Availability Engine
// -----------------------------------------------------------------------------

router.post('/availability/check', (req, res) => {
    const { room_type, check_in, nights } = req.body;

    if (!check_in || !nights || nights < 1) {
        return res.status(400).json({ success: false, error: "Invalid check_in or nights" });
    }

    const checkInDate = new Date(check_in);
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + parseInt(nights));

    const fmtCheckIn = checkInDate.toISOString().split('T')[0];
    const fmtCheckOut = checkOutDate.toISOString().split('T')[0];

    let sql = `
        SELECT r.* 
        FROM rooms r
        WHERE r.status = 'ACTIVE'
        AND r.id NOT IN (
            SELECT b.room_id 
            FROM bookings b 
            WHERE b.status NOT IN ('CANCELLED')
            AND (
                DATE(?) < b.check_out AND DATE(?) > b.check_in
            )
        )
    `;
    const params = [fmtCheckIn, fmtCheckOut];

    if (room_type && room_type !== 'All Types') {
        sql += " AND r.type = ?";
        params.push(room_type);
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({
            success: true,
            data: {
                available_rooms: rows,
                meta: { req_check_in: fmtCheckIn, req_check_out: fmtCheckOut, nights }
            }
        });
    });
});

// -----------------------------------------------------------------------------
// MODULE 3: Booking Management
// -----------------------------------------------------------------------------

router.post('/bookings', (req, res) => {
    const { room_id, client, check_in, nights } = req.body;

    if (!room_id || !client || !check_in || !nights) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const checkInDate = new Date(check_in);
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + parseInt(nights));

    const fmtCheckIn = checkInDate.toISOString().split('T')[0];
    const fmtCheckOut = checkOutDate.toISOString().split('T')[0];

    db.serialize(() => {
        // Double check availability
        db.get(`SELECT count(*) as conflict FROM bookings WHERE room_id = ? AND status != 'CANCELLED' AND (DATE(?) < check_out AND DATE(?) > check_in)`,
            [room_id, fmtCheckIn, fmtCheckOut], (err, row) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                if (row.conflict > 0) return res.status(409).json({ success: false, error: "Room is no longer available" });

                // Handle Client
                db.get("SELECT id FROM clients WHERE phone = ?", [client.phone], (err, crow) => {
                    const clientId = crow ? crow.id : uuidv4();
                    if (!crow) {
                        db.run("INSERT INTO clients (id, first_name, last_name, email, phone) VALUES (?, ?, ?, ?, ?)",
                            [clientId, client.first_name, client.last_name, client.email, client.phone]);
                    }

                    // Get Room Price
                    db.get("SELECT price FROM rooms WHERE id = ?", [room_id], (err, rrow) => {
                        if (err || !rrow) return res.status(500).json({ success: false, error: "Room error" });

                        const totalAmount = rrow.price * nights;
                        const bookingId = uuidv4();

                        db.run(`INSERT INTO bookings (id, room_id, client_id, check_in, check_out, total_amount, status) VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
                            [bookingId, room_id, clientId, fmtCheckIn, fmtCheckOut, totalAmount], (err) => {
                                if (err) return res.status(500).json({ success: false, error: err.message });
                                res.status(201).json({ success: true, data: { booking_id: bookingId, total_amount: totalAmount } });
                            });
                    });
                });
            });
    });
});

router.get('/bookings', (req, res) => {
    const sql = `
        SELECT b.*, r.number as room_number, r.name as room_name, c.first_name, c.last_name, c.phone 
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN clients c ON b.client_id = c.id
        ORDER BY b.created_at DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

// -----------------------------------------------------------------------------
// MODULE 4: Revenue Analytics
// -----------------------------------------------------------------------------

router.get('/revenue', (req, res) => {
    const { room_id, start_date, end_date } = req.query;

    let sql = `
        SELECT 
            r.id as room_id,
            r.name as room_name,
            r.price as price_per_night,
            COALESCE(SUM(
                JULIANDAY(CASE WHEN b.check_out > ? THEN ? ELSE b.check_out END) - 
                JULIANDAY(CASE WHEN b.check_in < ? THEN ? ELSE b.check_in END)
            ), 0) as nights_occupied
        FROM rooms r
        LEFT JOIN bookings b ON r.id = b.room_id 
            AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
            AND b.check_out > ? AND b.check_in < ?
        WHERE 1=1
    `;

    const queryParams = [end_date, end_date, start_date, start_date, start_date, end_date];

    if (room_id && room_id !== 'all') {
        sql += " AND r.id = ?";
        queryParams.push(room_id);
    }

    sql += " GROUP BY r.id";

    db.all(sql, queryParams, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        const data = rows.map(row => ({
            ...row,
            nights_occupied: Math.max(0, Math.ceil(row.nights_occupied || 0)),
            total_revenue: Math.max(0, Math.ceil(row.nights_occupied || 0)) * row.price_per_night
        }));

        res.json({ success: true, data });
    });
});

// -----------------------------------------------------------------------------
// MODULE 5: Client Management
// -----------------------------------------------------------------------------
router.get('/clients', (req, res) => {
    db.all("SELECT * FROM clients", [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

module.exports = router;
