const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// -----------------------------------------------------------------------------
// MODULE 1: Room & Room Type Logic
// -----------------------------------------------------------------------------

// List Room Types
router.get('/room-types', (req, res) => {
    db.all("SELECT * FROM room_types", [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        const types = rows.map(r => ({ ...r, features: JSON.parse(r.features) }));
        res.json({ success: true, data: types });
    });
});

// List Rooms
router.get('/rooms', (req, res) => {
    const { type, status } = req.query;
    let sql = "SELECT * FROM rooms WHERE 1=1";
    const params = [];

    if (type) {
        sql += " AND type_id = ?";
        params.push(type);
    }
    if (status) {
        sql += " AND status = ?";
        params.push(status);
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

// -----------------------------------------------------------------------------
// MODULE 2: Availability Engine (CRITICAL)
// -----------------------------------------------------------------------------

// Check Availability
router.post('/availability/check', (req, res) => {
    const { room_type_id, check_in, nights } = req.body;

    if (!check_in || !nights || nights < 1) {
        return res.status(400).json({ success: false, error: { message: "Invalid check_in or nights" } });
    }

    const checkInDate = new Date(check_in);
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + parseInt(nights));

    // Format dates as YYYY-MM-DD for SQLite comparison
    const fmtCheckIn = checkInDate.toISOString().split('T')[0];
    const fmtCheckOut = checkOutDate.toISOString().split('T')[0];

    // Query: Find rooms that are ACTIVE and NOT overlapping with existing confirmed bookings
    // Overlap logic: (req_in < book_out) AND (req_out > book_in)
    // We want rooms NOT IN (that set)

    let sql = `
        SELECT r.*, t.name as type_name, t.base_price 
        FROM rooms r
        JOIN room_types t ON r.type_id = t.id
        WHERE r.status = 'ACTIVE'
        AND r.id NOT IN (
            SELECT b.room_id 
            FROM bookings b 
            WHERE b.status != 'CANCELLED'
            AND (
                DATE(?) < b.check_out AND DATE(?) > b.check_in
            )
        )
    `;

    const params = [fmtCheckIn, fmtCheckOut];

    if (room_type_id) {
        sql += " AND r.type_id = ?";
        params.push(room_type_id);
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        // Group available rooms
        res.json({
            success: true,
            data: {
                available_rooms: rows,
                meta: {
                    req_check_in: fmtCheckIn,
                    req_check_out: fmtCheckOut,
                    nights: nights
                }
            }
        });
    });
});

// -----------------------------------------------------------------------------
// MODULE 3: Booking Management
// -----------------------------------------------------------------------------

// Create Booking
router.post('/bookings', (req, res) => {
    const { room_id, client, check_in, nights } = req.body;

    // 1. Basic Validation
    if (!room_id || !client || !check_in || !nights) {
        return res.status(400).json({ success: false, error: { message: "Missing required fields" } });
    }

    const checkInDate = new Date(check_in);
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + parseInt(nights));

    const fmtCheckIn = checkInDate.toISOString().split('T')[0];
    const fmtCheckOut = checkOutDate.toISOString().split('T')[0];

    // 2. Transaction-like: Check Availability AGAIN (Double Constraint)
    // Note: SQLite doesn't strictly support high-concurrency 'FOR UPDATE' locks easily without logic.
    // We will do a check-then-insert. In high-load, we'd need exclusion constraints.

    db.serialize(() => {
        // A. Verify Room availability
        db.get(`
            SELECT count(*) as conflict 
            FROM bookings 
            WHERE room_id = ? 
            AND status != 'CANCELLED'
            AND (DATE(?) < check_out AND DATE(?) > check_in)
        `, [room_id, fmtCheckIn, fmtCheckOut], (err, row) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            if (row.conflict > 0) {
                return res.status(409).json({ success: false, error: { message: "Room is no longer available for these dates." } });
            }

            // B. Client Logic (Find or Create)
            db.get("SELECT id FROM clients WHERE phone = ?", [client.phone], (err, row) => {
                if (err) return res.status(500).json({ success: false, error: err.message });

                let clientId;
                if (row) {
                    clientId = row.id;
                    createBookingStep(clientId);
                } else {
                    clientId = uuidv4();
                    db.run("INSERT INTO clients (id, first_name, last_name, email, phone) VALUES (?, ?, ?, ?, ?)",
                        [clientId, client.first_name, client.last_name, client.email, client.phone],
                        (err) => {
                            if (err) return res.status(500).json({ success: false, error: err.message });
                            createBookingStep(clientId);
                        }
                    );
                }
            });
        });
    });

    function createBookingStep(clientId) {
        // C. Calculate Price
        db.get("SELECT base_price FROM rooms r JOIN room_types t ON r.type_id = t.id WHERE r.id = ?", [room_id], (err, row) => {
            if (err || !row) return res.status(500).json({ success: false, error: "Room not found or price error" });

            const totalAmount = row.base_price * nights;
            const bookingId = uuidv4();

            // D. Insert Booking
            db.run(`INSERT INTO bookings (id, room_id, client_id, check_in, check_out, total_amount) VALUES (?, ?, ?, ?, ?, ?)`,
                [bookingId, room_id, clientId, fmtCheckIn, fmtCheckOut, totalAmount],
                (err) => {
                    if (err) return res.status(500).json({ success: false, error: err.message });

                    res.status(201).json({
                        success: true,
                        data: {
                            booking_id: bookingId,
                            status: "RESERVED",
                            total_amount: totalAmount,
                            dates: { check_in: fmtCheckIn, check_out: fmtCheckOut }
                        }
                    });
                }
            );
        });
    }
});

// List Bookings
router.get('/bookings', (req, res) => {
    const sql = `
        SELECT b.*, r.number as room_number, c.first_name, c.last_name, c.phone 
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

// Cancel Booking
router.post('/bookings/:id/cancel', (req, res) => {
    const bookingId = req.params.id;
    db.run("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?", [bookingId], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (this.changes === 0) return res.status(404).json({ success: false, error: "Booking not found" });

        res.json({ success: true, data: { id: bookingId, status: "CANCELLED" } });
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
