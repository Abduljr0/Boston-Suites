/**
 * Boston Suites — Full Booking Flow Test
 * Run: node test_booking_flow.js
 */
const http = require('http');

const BASE = 'http://localhost:5005/api/v1';

function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: 'localhost',
            port: 5005,
            path: '/api/v1' + path,
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        const req = http.request(opts, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

function pass(msg) { console.log('  ✅ ' + msg); }
function fail(msg) { console.log('  ❌ ' + msg); }
function step(n, title) { console.log(`\n=== STEP ${n}: ${title} ===`); }

async function run() {
    let roomId, bookingId, roomType, roomPrice, roomNumber;

    // ── STEP 1: Rooms endpoint ──────────────────────────────────────────────
    step(1, 'Health Check — GET /rooms');
    try {
        const r = await request('GET', '/rooms');
        if (r.body.success && r.body.data.length > 0) {
            pass(`Rooms API OK — ${r.body.data.length} room(s) found`);
            roomId     = r.body.data[0].id;
            roomType   = r.body.data[0].type;
            roomPrice  = r.body.data[0].price;
            roomNumber = r.body.data[0].number;
            console.log(`    Using room: ${roomNumber} (${roomType}) @ $${roomPrice}/night`);
        } else {
            fail('Rooms API returned no data: ' + JSON.stringify(r.body));
            return;
        }
    } catch (e) { fail('Cannot connect to backend — is server.js running on port 5005? ' + e.message); return; }

    // ── STEP 2: Check Availability ──────────────────────────────────────────
    step(2, 'Check Availability — POST /availability/check');
    try {
        const r = await request('POST', '/availability/check', {
            room_type: roomType, check_in: '2026-05-15', nights: 2
        });
        const rooms = (r.body.data && r.body.data.available_rooms) || [];
        if (r.body.success) {
            pass(`Availability check OK (${roomType}) — ${rooms.length} room(s) available`);
        } else {
            fail('Availability check failed: ' + JSON.stringify(r.body));
        }
    } catch (e) { fail(e.message); }

    // ── STEP 3: Create Booking ──────────────────────────────────────────────
    step(3, 'Create Booking — POST /bookings');
    try {
        const r = await request('POST', '/bookings', {
            room_id: roomId,
            guest_name: 'Test Guest',
            guest_phone: '0712345678',
            check_in_date: '2026-05-15',
            nights: 2,
            price_per_night: roomPrice,
            calculated_base_price: roomPrice * 2,
            final_price: roomPrice * 2,
            booking_status: 'pending_payment'
        });
        if (r.body.success) {
            bookingId = r.body.data.booking_id;
            pass(`Booking created — ID: BK-${bookingId.substring(0,8)}`);
        } else {
            fail('Booking creation failed: ' + JSON.stringify(r.body));
            return;
        }
    } catch (e) { fail(e.message); return; }

    // ── STEP 4: Fetch Booking Details (simulates payment page load) ─────────
    step(4, 'Fetch Booking Details — GET /bookings/:id');
    try {
        const r = await request('GET', `/bookings/${bookingId}`);
        const b = r.body.data || {};
        if (r.body.success) {
            pass(`Booking details loaded`);
            console.log(`    Guest: ${b.first_name} ${b.last_name} | Room: ${b.room_number} | Amount: $${b.total_amount} | Payment: ${b.payment_status}`);
        } else {
            fail('Fetch booking failed: ' + JSON.stringify(r.body));
        }
    } catch (e) { fail(e.message); }

    // ── STEP 5: Test M-Pesa STK Push ────────────────────────────────────────
    step(5, 'M-Pesa STK Push — POST /mpesa/stkpush');
    console.log('    (Calling Safaricom Sandbox — may take a moment...)');
    try {
        const r = await request('POST', '/mpesa/stkpush', {
            phone: '0712345678',
            amount: 200,
            accountReference: `BK-${bookingId.substring(0,8)}`,
            transactionDesc: 'Boston Suites Booking'
        });
        if (r.body.success) {
            pass('STK Push sent to Safaricom sandbox ✅');
            console.log('    Response:', JSON.stringify(r.body.data).substring(0, 120));
        } else {
            fail('STK Push failed (sandbox may require live credentials)');
            console.log('    Error:', JSON.stringify(r.body.error));
        }
    } catch (e) { fail('STK Push network error: ' + e.message); }

    // ── STEP 6: Update Payment Status to PAID ──────────────────────────────
    step(6, 'Update Payment Status — PATCH /bookings/:id/payment-status');
    try {
        const r = await request('PATCH', `/bookings/${bookingId}/payment-status`, {
            payment_status: 'PAID'
        });
        if (r.body.success) {
            pass('Booking marked as PAID');
        } else {
            fail('Payment status update failed: ' + JSON.stringify(r.body));
        }
    } catch (e) { fail(e.message); }

    // ── STEP 7: Verify Final Booking State ──────────────────────────────────
    step(7, 'Verify Final Booking State — GET /bookings/:id');
    try {
        const r = await request('GET', `/bookings/${bookingId}`);
        const b = r.body.data || {};
        if (r.body.success) {
            const paid = b.payment_status === 'PAID';
            paid ? pass('Payment status = PAID ✅') : fail('Payment status = ' + b.payment_status);
            console.log(`    Booking Status: ${b.status}`);
            console.log(`    Booking ID: BK-${bookingId.substring(0,8)}`);
        } else {
            fail('Final fetch failed: ' + JSON.stringify(r.body));
        }
    } catch (e) { fail(e.message); }

    // ── STEP 8: Simulate Check-in ───────────────────────────────────────────
    step(8, 'Check-In — PATCH /bookings/:id/check-in');
    try {
        const r = await request('PATCH', `/bookings/${bookingId}/check-in`);
        if (r.body.success) {
            pass('Guest checked in successfully');
        } else {
            fail('Check-in failed: ' + JSON.stringify(r.body));
        }
    } catch (e) { fail(e.message); }

    // ── STEP 9: Simulate Check-out ──────────────────────────────────────────
    step(9, 'Check-Out — PATCH /bookings/:id/check-out');
    try {
        const r = await request('PATCH', `/bookings/${bookingId}/check-out`);
        if (r.body.success) {
            pass('Guest checked out successfully');
        } else {
            fail('Check-out failed: ' + JSON.stringify(r.body));
        }
    } catch (e) { fail(e.message); }

    // ── Final State ─────────────────────────────────────────────────────────
    step('✓', 'Final Booking State');
    try {
        const r = await request('GET', `/bookings/${bookingId}`);
        const b = r.body.data || {};
        console.log(`    Payment: ${b.payment_status} | Status: ${b.status}`);
        console.log(`\n    🏁 All steps complete for booking BK-${bookingId.substring(0,8)}`);
    } catch (e) { fail(e.message); }
}

run().catch(console.error);
