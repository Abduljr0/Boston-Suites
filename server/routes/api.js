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

router.put('/bookings/:id', (req, res) => {
    const { id } = req.params;
    const {
        room_id,
        guest_name,
        guest_phone,
        check_in_date,
        nights,
        price_per_night,
        calculated_base_price,
        final_price
    } = req.body;

    if (!room_id || !guest_name || !guest_phone || !check_in_date || !nights) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    db.serialize(() => {
        // 1. Verify booking exists and is editable
        db.get("SELECT status, client_id FROM bookings WHERE id = ?", [id], (err, currentBooking) => {
            if (err || !currentBooking) return res.status(404).json({ success: false, error: "Booking not found" });

            if (currentBooking.status !== 'PENDING_PAYMENT') {
                return res.status(400).json({ success: false, error: "Only PENDING_PAYMENT bookings can be edited" });
            }

            const checkInDate = new Date(check_in_date);
            const checkOutDate = new Date(checkInDate);
            checkOutDate.setDate(checkOutDate.getDate() + parseInt(nights));
            const fmtCheckIn = checkInDate.toISOString().split('T')[0];
            const fmtCheckOut = checkOutDate.toISOString().split('T')[0];

            // 2. Revalidate availability (excluding THIS booking ID)
            const conflictSql = `
                SELECT count(*) as conflict 
                FROM bookings 
                WHERE room_id = ? 
                AND id != ? 
                AND status NOT IN ('CANCELLED')
                AND (DATE(?) < check_out AND DATE(?) > check_in)
            `;

            db.get(conflictSql, [room_id, id, fmtCheckIn, fmtCheckOut], (err, row) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                if (row.conflict > 0) {
                    return res.status(409).json({ success: false, error: "Room is not available for the selected dates" });
                }

                // 3. Update Client Info
                const nameParts = guest_name.trim().split(/\s+/);
                const firstName = nameParts[0];
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Guest';

                db.run("UPDATE clients SET first_name = ?, last_name = ?, phone = ? WHERE id = ?",
                    [firstName, lastName, guest_phone, currentBooking.client_id], (err) => {
                        if (err) return res.status(500).json({ success: false, error: "Failed to update guest info" });

                        // 4. Update Booking Info
                        const sql = `UPDATE bookings SET 
                            room_id = ?, check_in = ?, check_out = ?, nights = ?, 
                            price_per_night = ?, calculated_base_price = ?, total_amount = ?
                            WHERE id = ?`;

                        db.run(sql, [
                            room_id, fmtCheckIn, fmtCheckOut, nights,
                            price_per_night, calculated_base_price, final_price,
                            id
                        ], (err) => {
                            if (err) return res.status(500).json({ success: false, error: err.message });
                            res.json({ success: true, message: "Booking updated successfully" });
                        });
                    });
            });
        });
    });
});

router.post('/bookings', (req, res) => {
    const {
        room_id,
        guest_name,
        guest_phone,
        check_in_date,
        nights,
        price_per_night,
        calculated_base_price,
        final_price,
        booking_status
    } = req.body;

    if (!room_id || !guest_name || !guest_phone || !check_in_date || !nights) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields",
            received: req.body
        });
    }

    const checkInDate = new Date(check_in_date);
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + parseInt(nights));

    const fmtCheckIn = checkInDate.toISOString().split('T')[0];
    const fmtCheckOut = checkOutDate.toISOString().split('T')[0];

    // Split guest_name into first/last for the clients table
    const nameParts = guest_name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Guest';

    db.serialize(() => {
        // Double check availability
        db.get(`SELECT count(*) as conflict FROM bookings WHERE room_id = ? AND status != 'CANCELLED' AND (DATE(?) < check_out AND DATE(?) > check_in)`,
            [room_id, fmtCheckIn, fmtCheckOut], (err, row) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                if (row.conflict > 0) return res.status(409).json({ success: false, error: "Room is no longer available" });

                // Handle Client
                db.get("SELECT id FROM clients WHERE phone = ?", [guest_phone], (err, crow) => {
                    const clientId = crow ? crow.id : uuidv4();
                    if (!crow) {
                        db.run("INSERT INTO clients (id, first_name, last_name, phone) VALUES (?, ?, ?, ?)",
                            [clientId, firstName, lastName, guest_phone]);
                    }

                    const bookingId = uuidv4();
                    const status = (booking_status || 'PENDING_PAYMENT').toUpperCase();

                    db.run(`INSERT INTO bookings (
                        id, room_id, client_id, check_in, check_out, 
                        nights, price_per_night, calculated_base_price, 
                        total_amount, status, payment_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID')`,
                        [
                            bookingId, room_id, clientId, fmtCheckIn, fmtCheckOut,
                            nights, price_per_night, calculated_base_price,
                            final_price, status
                        ], (err) => {
                            if (err) return res.status(500).json({ success: false, error: err.message });
                            res.status(201).json({
                                success: true,
                                data: {
                                    booking_id: bookingId,
                                    total_amount: final_price,
                                    status: status
                                }
                            });
                        });
                });
            });
    });
});

router.patch('/bookings/:id/check-in', (req, res) => {
    const { id } = req.params;
    const now = new Date().toISOString();

    db.get("SELECT status FROM bookings WHERE id = ?", [id], (err, row) => {
        if (err || !row) return res.status(404).json({ success: false, error: "Booking not found" });

        if (row.status !== 'CONFIRMED') {
            return res.status(400).json({ success: false, error: "Only CONFIRMED bookings can be checked in. Current status: " + row.status });
        }

        const sql = "UPDATE bookings SET status = 'CHECKED_IN', actual_check_in = ? WHERE id = ?";
        db.run(sql, [now, id], function (err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, message: "Checked in successfully", checked_in_at: now });
        });
    });
});

router.patch('/bookings/:id/check-out', (req, res) => {
    const { id } = req.params;
    const now = new Date().toISOString();

    db.get("SELECT status FROM bookings WHERE id = ?", [id], (err, row) => {
        if (err || !row) return res.status(404).json({ success: false, error: "Booking not found" });

        if (row.status !== 'CHECKED_IN') {
            return res.status(400).json({ success: false, error: "Only CHECKED_IN bookings can be checked out. Current status: " + row.status });
        }

        const sql = "UPDATE bookings SET status = 'CHECKED_OUT', actual_check_out = ? WHERE id = ?";
        db.run(sql, [now, id], function (err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, message: "Checked out successfully", checked_out_at: now });
        });
    });
});

router.patch('/bookings/:id/payment-status', (req, res) => {
    const { payment_status } = req.body;
    const { id } = req.params;

    if (!payment_status) {
        return res.status(400).json({ success: false, error: "Missing payment_status" });
    }

    let bookingStatusUpdate = "";
    if (payment_status === 'PAID') {
        bookingStatusUpdate = ", status = 'CONFIRMED'";
    } else if (payment_status === 'on_hold') {
        bookingStatusUpdate = ", status = 'PENDING_PAYMENT'";
    }

    const sql = `UPDATE bookings SET payment_status = ? ${bookingStatusUpdate} WHERE id = ?`;
    db.run(sql, [payment_status, id], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (this.changes === 0) return res.status(404).json({ success: false, error: "Booking not found" });
        res.json({
            success: true,
            message: `Payment status updated to ${payment_status}`,
            new_booking_status: payment_status === 'PAID' ? 'CONFIRMED' : 'PENDING_PAYMENT'
        });
    });
});

router.get('/bookings/:id', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT b.*, r.number as room_number, r.name as room_name, r.type as room_type,
               c.first_name, c.last_name, c.phone 
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN clients c ON b.client_id = c.id
        WHERE b.id = ?
    `;
    db.get(sql, [id], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!row) return res.status(404).json({ success: false, error: "Booking not found" });
        res.json({ success: true, data: row });
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
