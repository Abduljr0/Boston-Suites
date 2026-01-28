// ============================================================================
// GLOBAL API CONFIGURATION
// ============================================================================
// Read API base URL from global config injected in index.html
// This allows environment-specific configuration without rebuilding JS
const API_BASE = window.__APP_CONFIG__?.API_BASE_URL || 'http://localhost:5005/api/v1';
const DEBUG_MODE = window.__APP_CONFIG__?.DEBUG || false;

// Log configuration on load (helps with debugging)
if (DEBUG_MODE) {
    console.log("🔧 Boston Suites Admin Dashboard");
    console.log("📡 API Base URL:", API_BASE);
    console.log("🌍 Environment:", window.__APP_CONFIG__?.ENVIRONMENT || "unknown");
}

document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let currentRooms = [];
    let editRoomId = null;
    let editBookingId = null;
    let allRooms = [];

    // --- Initialization ---
    initNavigation();
    initTheme();
    initRoomsModule();
    initRevenueModule();
    initAvailabilityModule();
    initBookingModule();
    initPaymentModule();

    // Initial load
    loadDashboardStats();
    fetchAllRooms();

    // --- Core Navigation Logic ---
    function initNavigation() {
        const menuItems = document.querySelectorAll('.menu-item');
        const views = document.querySelectorAll('.view-section');
        const sidebar = document.querySelector('.sidebar');
        const toggleBtn = document.getElementById('toggleSidebar');

        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                if (item.classList.contains('disabled')) return;

                const targetId = item.getAttribute('data-target');
                if (!targetId) return;

                // UI Updates
                menuItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                views.forEach(v => v.classList.remove('active'));

                const targetView = document.getElementById(targetId);
                if (targetView) {
                    targetView.classList.add('active');
                    // Refresh modules on view change
                    if (targetId === 'view-dashboard') loadDashboardStats();
                    if (targetId === 'view-rooms') loadRooms();
                    if (targetId === 'view-revenue') loadRevenueFilters();
                    if (targetId === 'view-bookings') loadBookings();
                    if (targetId === 'view-clients') loadClients();
                    if (targetId === 'view-payment') {
                        const urlParams = new URLSearchParams(window.location.search);
                        const bId = urlParams.get('bookingId');
                        if (bId) loadPaymentDetails(bId);
                    }
                    if (targetId === 'view-book-room') {
                        // Regular menu click should always start fresh
                        editBookingId = null;
                        const title = document.getElementById('book-room-title');
                        if (title) title.textContent = "New Booking";
                        const form = document.getElementById('bookRoomForm');
                        if (form) {
                            const inputs = form.querySelectorAll('input, select');
                            inputs.forEach(input => input.removeAttribute('disabled'));
                            const submitBtn = form.querySelector('button[type="submit"]');
                            if (submitBtn) submitBtn.style.display = 'block';
                            form.reset();
                        }
                    }
                }

                // Mobile sidebar close
                if (window.innerWidth <= 768) sidebar.classList.remove('active');
            });
        });

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => sidebar.classList.toggle('active'));
        }
    }

    // --- Theme Module ---
    function initTheme() {
        window.setTheme = (theme) => {
            const lightBtn = document.getElementById('theme-light-btn');
            const darkBtn = document.getElementById('theme-dark-btn');
            if (theme === 'dark') {
                document.body.classList.add('theme-dark');
                lightBtn?.classList.remove('active');
                darkBtn?.classList.add('active');
            } else {
                document.body.classList.remove('theme-dark');
                lightBtn?.classList.add('active');
                darkBtn?.classList.remove('active');
            }
            localStorage.setItem('admin-theme', theme);
        };
        const savedTheme = localStorage.getItem('admin-theme') || 'light';
        window.setTheme(savedTheme);
    }

    // --- Dashboard Stats ---
    async function loadDashboardStats() {
        try {
            const [roomsRes, bookingsRes] = await Promise.all([
                fetch(`${API_BASE}/rooms`),
                fetch(`${API_BASE}/bookings`)
            ]);

            // Validate HTTP responses
            if (!roomsRes.ok || !bookingsRes.ok) {
                throw new Error(`API returned error status: ${roomsRes.status} / ${bookingsRes.status}`);
            }

            const roomsData = await roomsRes.json();
            const bookingsData = await bookingsRes.json();

            if (DEBUG_MODE) {
                console.log("✅ Dashboard API data loaded:", { rooms: roomsData, bookings: bookingsData });
            }

            const rooms = roomsData.data || [];
            const bookings = bookingsData.data || [];

            document.getElementById('stat-total-rooms').textContent = rooms.length;

            // Derive occupancy (Only those actually CHECKED_IN)
            const occupiedCount = bookings.filter(b => b.status === 'CHECKED_IN').length;
            document.getElementById('stat-occupied').textContent = occupiedCount;
            document.getElementById('stat-available').textContent = rooms.length - occupiedCount;

            const today = new Date().toISOString().split('T')[0];

            // Expected for today (not cancelled)
            const expectedCheckins = bookings.filter(b => b.check_in === today && b.status !== 'CANCELLED').length;
            const expectedCheckouts = bookings.filter(b => b.check_out === today && b.status !== 'CANCELLED').length;

            // Actuals performed today
            const actualCheckins = bookings.filter(b => b.actual_check_in && b.actual_check_in.startsWith(today)).length;
            const actualCheckouts = bookings.filter(b => b.actual_check_out && b.actual_check_out.startsWith(today)).length;

            document.getElementById('stat-checkins').textContent = actualCheckins;
            document.getElementById('stat-checkouts').textContent = actualCheckouts;

        } catch (err) {
            console.error("❌ Backend connection failed:", err.message);
            console.error("🔍 API Base URL:", API_BASE);
            console.error("💡 Tip: Check if backend is running and CORS is enabled");

            // Graceful UI fallback - keep dashes visible
            ['stat-total-rooms', 'stat-occupied', 'stat-available', 'stat-checkins', 'stat-checkouts'].forEach(id => {
                const el = document.getElementById(id);
                if (el && el.textContent === '—') {
                    el.textContent = '—';
                    el.style.color = '#999';
                }
            });
        }
    }

    async function fetchAllRooms() {
        try {
            const res = await fetch(`${API_BASE}/rooms`);
            const json = await res.json();
            if (json.success) {
                allRooms = json.data;
                const select = document.getElementById('booking-room-id');
                if (select) {
                    select.innerHTML = '<option value="">Select an available room...</option>';
                    allRooms.forEach(r => {
                        const opt = document.createElement('option');
                        opt.value = r.id;
                        opt.textContent = `Room ${r.number} - ${r.type} ($${r.price})`;
                        opt.dataset.price = r.price;
                        opt.dataset.type = r.type;
                        select.appendChild(opt);
                    });
                }
            }
        } catch (err) { console.error("Error fetching rooms:", err); }
    }

    // --- Rooms Module ---
    function initRoomsModule() {
        const addBtn = document.getElementById('toggleAddRoomForm');
        const collapse = document.getElementById('addRoomCollapse');
        const cancelBtn = document.getElementById('cancelAddRoom');
        const form = document.getElementById('addRoomForm');

        addBtn?.addEventListener('click', () => {
            resetRoomForm();
            collapse.classList.toggle('show');
        });

        cancelBtn?.addEventListener('click', () => {
            collapse.classList.remove('show');
            resetRoomForm();
        });

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('roomSubmitBtn');
            submitBtn.disabled = true;

            const formData = new FormData(form);
            const method = editRoomId ? 'PUT' : 'POST';
            const url = editRoomId ? `${API_BASE}/rooms/${editRoomId}` : `${API_BASE}/rooms`;

            try {
                const response = await fetch(url, { method, body: formData });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                if (result.success) {
                    collapse.classList.remove('show');
                    resetRoomForm();
                    loadRooms();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (err) {
                console.error('❌ Room save failed:', err.message);
                alert(`Failed to save room: ${err.message}\n\nCheck console for details.`);
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    async function loadRooms() {
        try {
            const res = await fetch(`${API_BASE}/rooms`);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: Failed to fetch rooms`);
            }

            const json = await res.json();

            if (DEBUG_MODE) {
                console.log("✅ Rooms API data loaded:", json);
            }

            if (!json.success || !json.data || json.data.length === 0) {
                renderEmptyState('roomsTableBody', 'roomsEmptyState');
                return;
            }

            currentRooms = json.data;
            const tbody = document.getElementById('roomsTableBody');
            document.getElementById('roomsEmptyState').style.display = 'none';

            tbody.innerHTML = '';
            currentRooms.forEach(room => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            ${room.image_url ? `<img src="http://localhost:8080${room.image_url}" class="room-img-preview">` : '<div class="room-img-preview"></div>'}
                            <strong>${room.number}</strong>
                        </div>
                    </td>
                    <td>${room.type}</td>
                    <td>${room.beds}</td>
                    <td>$${room.price.toFixed(2)}</td>
                    <td><span class="status-badge ${room.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}">${room.status}</span></td>
                    <td>
                        <button class="btn btn-outline btn-edit" data-id="${room.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-outline btn-delete" data-id="${room.id}" style="color:var(--danger-color); border-color:var(--danger-color);"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            document.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', handleEditRoom));
            document.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', handleDeleteRoom));
        } catch (err) {
            console.error('❌ Failed to load rooms:', err.message);
            console.error('🔍 API URL:', `${API_BASE}/rooms`);
            renderEmptyState('roomsTableBody', 'roomsEmptyState', 'Backend connection error');
        }
    }

    function handleEditRoom(e) {
        const id = e.currentTarget.getAttribute('data-id');
        const room = currentRooms.find(r => r.id === id);
        if (!room) return;

        editRoomId = id;
        const form = document.getElementById('addRoomForm');
        form.number.value = room.number;
        form.name.value = room.name || '';
        form.type.value = room.type;
        form.beds.value = room.beds;
        form.price.value = room.price;
        form.description.value = room.description || '';
        form.status.value = room.status;

        document.getElementById('roomSubmitBtn').textContent = 'Update Room';
        document.getElementById('addRoomCollapse').classList.add('show');
    }

    async function handleDeleteRoom(e) {
        if (!confirm('Are you sure you want to delete this room?')) return;
        const id = e.currentTarget.getAttribute('data-id');
        try {
            const res = await fetch(`${API_BASE}/rooms/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) loadRooms();
        } catch (err) { console.error(err); }
    }

    function resetRoomForm() {
        editRoomId = null;
        document.getElementById('addRoomForm').reset();
        document.getElementById('roomSubmitBtn').textContent = 'Create Room';
    }

    // --- Revenue Module ---
    function initRevenueModule() {
        const filterForm = document.getElementById('revenueFilterForm');
        const quickRange = document.getElementById('rev-quick-range');

        quickRange?.addEventListener('change', () => {
            const now = new Date();
            let start = new Date();
            let end = new Date();

            if (quickRange.value === 'today') {
                start.setHours(0, 0, 0, 0);
            } else if (quickRange.value === 'last7') {
                start.setDate(now.getDate() - 7);
            } else if (quickRange.value === 'thisMonth') {
                start = new Date(now.getFullYear(), now.getMonth(), 1);
            }

            if (quickRange.value !== 'custom') {
                document.getElementById('rev-start-date').value = start.toISOString().split('T')[0];
                document.getElementById('rev-end-date').value = end.toISOString().split('T')[0];
            }
        });

        quickRange?.dispatchEvent(new Event('change'));

        filterForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const roomId = document.getElementById('rev-room-filter').value;
            const start = document.getElementById('rev-start-date').value;
            const end = document.getElementById('rev-end-date').value;

            try {
                const res = await fetch(`${API_BASE}/revenue?room_id=${roomId}&start_date=${start}&end_date=${end}`);
                const json = await res.json();
                console.log("Revenue API data loaded:", json);
                renderRevenueTable(json.data);
            } catch (err) { console.error(err); }
        });
    }

    async function loadRevenueFilters() {
        try {
            const res = await fetch(`${API_BASE}/rooms`);
            const json = await res.json();
            const select = document.getElementById('rev-room-filter');
            select.innerHTML = '<option value="all">All Rooms</option>';
            json.data?.forEach(room => {
                const option = document.createElement('option');
                option.value = room.id;
                option.textContent = `${room.number} - ${room.name || room.type}`;
                select.appendChild(option);
            });
        } catch (err) { console.error(err); }
    }

    function renderRevenueTable(data) {
        const tbody = document.getElementById('revenueTableBody');
        const tfoot = document.getElementById('revenueTotal');
        const emptyState = document.getElementById('revenueEmptyState');

        tbody.innerHTML = '';
        tfoot.innerHTML = '';

        if (!data || data.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        let totalRev = 0;
        let totalNights = 0;

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.room_name}</td>
                <td>${row.nights_occupied}</td>
                <td>$${row.price_per_night.toFixed(2)}</td>
                <td>$${row.total_revenue.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
            totalRev += row.total_revenue;
            totalNights += row.nights_occupied;
        });

        tfoot.innerHTML = `
            <tr style="background:#f9f9f9; font-weight:bold;">
                <td>TOTAL</td>
                <td>${totalNights}</td>
                <td>-</td>
                <td>$${totalRev.toFixed(2)}</td>
            </tr>
        `;
    }

    // --- Availability Module ---
    function initAvailabilityModule() {
        const checkForm = document.getElementById('checkAvailabilityForm');
        checkForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const resultsDiv = document.getElementById('availabilityResults');
            resultsDiv.style.display = 'none';

            const btn = checkForm.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Checking...';

            const payload = {
                room_type: checkForm.querySelector('select').value,
                check_in: checkForm.querySelector('input[type="date"]').value,
                nights: checkForm.querySelector('input[type="number"]').value
            };

            try {
                const res = await fetch(`${API_BASE}/availability/check`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                console.log("Availability API data loaded:", json);
                renderAvailability(json.data.available_rooms);
                resultsDiv.style.display = 'block';
            } catch (err) { console.error(err); }
            finally { btn.textContent = originalText; }
        });
    }

    function renderAvailability(rooms) {
        const tbody = document.getElementById('availabilityTableBody');
        tbody.innerHTML = '';
        if (!rooms || rooms.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No rooms found for these criteria.</td></tr>';
            return;
        }
        rooms.forEach(room => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${room.number}</td>
                <td>${room.type}</td>
                <td>$${room.price}</td>
                <td>${room.beds} Beds</td>
                <td><button class="btn btn-primary btn-book-now" data-id="${room.id}">Book</button></td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-book-now').forEach(b => b.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const room = rooms.find(r => r.id === id);

            // Get original search criteria
            const searchForm = document.getElementById('checkAvailabilityForm');
            const searchCheckIn = searchForm.querySelector('input[type="date"]').value;
            const searchNights = searchForm.querySelector('input[type="number"]').value;

            // Reset state
            editBookingId = null;
            document.getElementById('book-room-title').textContent = "New Booking";

            document.querySelector('.menu-item[data-target="view-book-room"]').click();

            const bookForm = document.getElementById('bookRoomForm');
            // Ensure fields are enabled (in case previously in 'view' mode)
            const inputs = bookForm.querySelectorAll('input, select');
            inputs.forEach(input => input.removeAttribute('disabled'));
            bookForm.querySelector('button[type="submit"]').style.display = 'block';

            const roomSelect = document.getElementById('booking-room-id');
            roomSelect.value = id;

            // Populate criteria
            document.getElementById('booking-check-in').value = searchCheckIn;
            document.getElementById('booking-nights').value = searchNights;

            // Trigger initial calculation
            calculateBookingPrice();
        }));
    }

    function calculateBookingPrice() {
        const bookForm = document.getElementById('bookRoomForm');
        const roomSelect = document.getElementById('booking-room-id');
        const nightsInput = document.getElementById('booking-nights');
        const totalPriceInput = document.getElementById('booking-total-price');
        const basePriceDisplay = document.getElementById('booking-base-price-display');
        const roomInfo = document.getElementById('booking-room-type-info');

        const nights = parseInt(nightsInput.value) || 0;
        let pricePerNight = 0;

        if (roomSelect.selectedIndex > 0) {
            const opt = roomSelect.options[roomSelect.selectedIndex];
            pricePerNight = parseFloat(opt.dataset.price) || 0;
            if (roomInfo) roomInfo.textContent = `Type: ${opt.dataset.type} room selected.`;
        } else if (roomInfo) {
            roomInfo.textContent = '';
        }

        const calculatedBasePrice = nights * pricePerNight;
        totalPriceInput.value = calculatedBasePrice.toFixed(2);

        if (basePriceDisplay) {
            basePriceDisplay.textContent = `Base: $${calculatedBasePrice.toFixed(2)}`;
            basePriceDisplay.style.display = nights > 0 ? 'inline' : 'none';
        }

        if (DEBUG_MODE) {
            console.log("💰 Price Calculated:", { nights, pricePerNight, calculatedBasePrice });
        }
    }

    // --- Bookings Module ---
    function initBookingModule() {
        const form = document.getElementById('bookRoomForm');
        const nightsInput = document.getElementById('booking-nights');
        const totalPriceInput = document.getElementById('booking-total-price');

        // Real-time calculation on nights or room change
        nightsInput?.addEventListener('input', () => calculateBookingPrice());
        document.getElementById('booking-room-id')?.addEventListener('change', () => calculateBookingPrice());

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const roomSelect = document.getElementById('booking-room-id');
            const roomId = roomSelect.value;

            if (!roomId) return alert('Please select a room');

            const nights = parseInt(nightsInput.value);
            const finalPrice = parseFloat(totalPriceInput.value);

            const selectedOpt = roomSelect.options[roomSelect.selectedIndex];
            const pricePerNight = parseFloat(selectedOpt.dataset.price) || 0;
            const basePrice = pricePerNight * nights;

            const payload = {
                room_id: roomId,
                guest_name: document.getElementById('booking-client-name').value,
                guest_phone: document.getElementById('booking-phone').value,
                check_in_date: document.getElementById('booking-check-in').value,
                nights: nights,
                price_per_night: pricePerNight,
                calculated_base_price: basePrice,
                final_price: finalPrice,
                booking_status: "pending_payment"
            };

            const url = editBookingId ? `${API_BASE}/bookings/${editBookingId}` : `${API_BASE}/bookings`;
            const method = editBookingId ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const json = await res.json();

                if (res.ok) {
                    const bookingId = editBookingId || json.data.booking_id;
                    alert(editBookingId ? 'Booking updated!' : 'Booking created!');

                    // Navigate to payment
                    const newUrl = `${window.location.pathname}?view=payment&bookingId=${bookingId}`;
                    window.history.pushState({ path: newUrl }, '', newUrl);

                    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
                    document.getElementById('view-payment').classList.add('active');
                    loadPaymentDetails(bookingId);

                    form.reset();
                    editBookingId = null;
                } else {
                    alert('Error: ' + (json.error || 'Operation failed'));
                }
            } catch (err) {
                console.error("Booking Error:", err);
                alert("Failed to connect to server.");
            }
        });
    }

    // --- Payment Module ---
    function initPaymentModule() {
        const btnProcess = document.getElementById('btn-process-payment');
        const btnHold = document.getElementById('btn-hold-payment');

        btnProcess?.addEventListener('click', async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const bookingId = urlParams.get('bookingId');
            if (!bookingId) return alert("No booking ID found");

            try {
                const res = await fetch(`${API_BASE}/bookings/${bookingId}/payment-status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payment_status: 'PAID' })
                });
                const json = await res.json();
                if (json.success) {
                    alert('Booking Confirmed and Paid!');
                    loadPaymentDetails(bookingId);
                } else {
                    alert('Error: ' + json.error);
                }
            } catch (err) { console.error(err); }
        });

        btnHold?.addEventListener('click', async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const bookingId = urlParams.get('bookingId');
            if (!bookingId) return alert("No booking ID found");

            try {
                const res = await fetch(`${API_BASE}/bookings/${bookingId}/payment-status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payment_status: 'on_hold' })
                });
                const json = await res.json();
                if (json.success) {
                    alert('Payment deferred. Returning to bookings list.');
                    document.querySelector('.menu-item[data-target="view-bookings"]').click();
                } else {
                    alert('Error: ' + json.error);
                }
            } catch (err) { console.error(err); }
        });
    }

    async function loadPaymentDetails(bookingId) {
        const summaryContent = document.getElementById('payment-summary-content');
        const statusBadge = document.getElementById('payment-current-status');

        try {
            const res = await fetch(`${API_BASE}/bookings/${bookingId}`);
            const json = await res.json();

            if (json.success) {
                const b = json.data;

                // Update Badge
                statusBadge.textContent = b.payment_status || 'UNPAID';
                statusBadge.className = 'status-badge ' +
                    (b.payment_status === 'PAID' ? 'status-active' :
                        b.payment_status === 'on_hold' ? 'status-inactive' : 'status-danger');

                // Render Summary
                summaryContent.innerHTML = `
                    <div style="line-height: 1.8;">
                        <p><strong>Booking ID:</strong> <span style="font-family: monospace;">#BK-${b.id.substring(0, 8)}</span></p>
                        <p><strong>Guest:</strong> ${b.first_name} ${b.last_name}</p>
                        <p><strong>Phone:</strong> ${b.phone}</p>
                        <hr style="margin: 0.5rem 0; border: 0; border-top: 1px dashed #eee;">
                        <p><strong>Room:</strong> ${b.room_number} (${b.room_name || b.room_type})</p>
                        <p><strong>Rate:</strong> $${b.price_per_night?.toFixed(2)} / night</p>
                        <p><strong>Stay:</strong> ${b.check_in} to ${b.check_out} (${b.nights} nights)</p>
                        <hr style="margin: 0.5rem 0; border: 0; border-top: 1px dashed #eee;">
                        <p style="font-size: 1.2rem; color: var(--primary-color);"><strong>Total Amount: $${b.total_amount.toFixed(2)}</strong></p>
                    </div>
                `;
            } else {
                summaryContent.innerHTML = `<p style="color: red;">Error: ${json.error}</p>`;
            }
        } catch (err) {
            console.error(err);
            summaryContent.innerHTML = `<p style="color: red;">Failed to load booking details.</p>`;
        }
    }

    async function loadBookings() {
        try {
            const res = await fetch(`${API_BASE}/bookings`);
            const json = await res.json();
            console.log("Bookings API data loaded:", json);

            const tbody = document.getElementById('bookingsTableBody');
            const emptyState = document.getElementById('bookingsEmptyState');
            tbody.innerHTML = '';

            if (!json.success || !json.data || json.data.length === 0) {
                emptyState.style.display = 'block';
                return;
            }
            emptyState.style.display = 'none';

            json.data.forEach(bk => {
                const tr = document.createElement('tr');
                const isPending = bk.status === 'PENDING_PAYMENT' || bk.payment_status !== 'PAID';

                tr.innerHTML = `
                    <td>#BK-${bk.id.substring(0, 8)}</td>
                    <td>${bk.first_name} ${bk.last_name}</td>
                    <td>${bk.room_number} (${bk.room_name || bk.room_type || ''})</td>
                    <td>${bk.check_in}</td>
                    <td>${bk.check_out}</td>
                    <td>
                        <span class="status-badge ${bk.payment_status === 'PAID' ? 'status-active' : bk.payment_status === 'on_hold' ? 'status-on-hold' : 'status-danger'}">
                            ${bk.payment_status || 'UNPAID'}
                        </span>
                        <br>
                        <small class="status-text-${bk.status.toLowerCase()}" style="font-size: 0.7rem;">${bk.status.replace('_', ' ')}</small>
                    </td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn btn-outline btn-view-booking" data-id="${bk.id}" title="View Details"><i class="fas fa-eye"></i></button>
                            ${isPending ? `
                                <button class="btn btn-outline btn-edit-booking" data-id="${bk.id}" title="Edit Booking" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-primary btn-pay-now" data-id="${bk.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">Pay Now</button>
                            ` : ''}
                            ${bk.status === 'CONFIRMED' ? `
                                <button class="btn btn-primary btn-check-in" data-id="${bk.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; background-color: #27ae60; border-color: #27ae60;">Check-in</button>
                            ` : ''}
                            ${bk.status === 'CHECKED_IN' ? `
                                <button class="btn btn-primary btn-check-out" data-id="${bk.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; background-color: #e67e22; border-color: #e67e22;">Check-out</button>
                            ` : ''}
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Handlers for dynamic buttons
            document.querySelectorAll('.btn-pay-now').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    const newUrl = `${window.location.pathname}?view=payment&bookingId=${id}`;
                    window.history.pushState({ path: newUrl }, '', newUrl);

                    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
                    document.getElementById('view-payment').classList.add('active');
                    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));

                    loadPaymentDetails(id);
                });
            });

            document.querySelectorAll('.btn-edit-booking').forEach(btn => {
                btn.addEventListener('click', (e) => openBookingForm(e.currentTarget.getAttribute('data-id'), 'edit'));
            });

            document.querySelectorAll('.btn-view-booking').forEach(btn => {
                btn.addEventListener('click', (e) => openBookingForm(e.currentTarget.getAttribute('data-id'), 'view'));
            });

            document.querySelectorAll('.btn-check-in').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (confirm("Are you sure you want to Check-in this guest?")) {
                        try {
                            const res = await fetch(`${API_BASE}/bookings/${id}/check-in`, { method: 'PATCH' });
                            const json = await res.json();
                            if (json.success) {
                                alert("Guest checked in successfully!");
                                loadBookings();
                                loadDashboardStats(); // Update occupancy counts
                            } else {
                                alert("Error: " + json.error);
                            }
                        } catch (err) { console.error(err); }
                    }
                });
            });

            document.querySelectorAll('.btn-check-out').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (confirm("Process Check-out for this guest?")) {
                        try {
                            const res = await fetch(`${API_BASE}/bookings/${id}/check-out`, { method: 'PATCH' });
                            const json = await res.json();
                            if (json.success) {
                                alert("Guest checked out successfully!");
                                loadBookings();
                                loadDashboardStats(); // Update occupancy counts
                            } else {
                                alert("Error: " + json.error);
                            }
                        } catch (err) { console.error(err); }
                    }
                });
            });
        } catch (err) {
            console.error(err);
            renderEmptyState('bookingsTableBody', 'bookingsEmptyState', 'Backend not connected');
        }
    }

    async function openBookingForm(bookingId, mode = 'edit') {
        try {
            const res = await fetch(`${API_BASE}/bookings/${bookingId}`);
            const json = await res.json();
            if (json.success) {
                const b = json.data;
                editBookingId = bookingId;

                const title = document.getElementById('book-room-title');
                const form = document.getElementById('bookRoomForm');
                const submitBtn = form.querySelector('button[type="submit"]');

                title.textContent = mode === 'view' ? "View Booking Details" : "Edit Booking";

                // Toggle Read-only state
                const inputs = form.querySelectorAll('input, select');
                inputs.forEach(input => {
                    if (mode === 'view') input.setAttribute('disabled', 'true');
                    else input.removeAttribute('disabled');
                });

                if (mode === 'view') submitBtn.style.display = 'none';
                else submitBtn.style.display = 'block';

                // Navigation UI
                document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
                document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
                document.getElementById('view-book-room').classList.add('active');

                // Populate Form
                document.getElementById('booking-room-id').value = b.room_id;
                document.getElementById('booking-client-name').value = `${b.first_name} ${b.last_name}`;
                document.getElementById('booking-phone').value = b.phone;
                document.getElementById('booking-check-in').value = b.check_in;
                document.getElementById('booking-nights').value = b.nights;

                calculateBookingPrice(); // Updates base and room info
                document.getElementById('booking-total-price').value = b.total_amount.toFixed(2);
            }
        } catch (err) { console.error(err); }
    }

    // --- Clients Module ---
    async function loadClients() {
        try {
            const res = await fetch(`${API_BASE}/clients`);
            const json = await res.json();
            console.log("Clients API data loaded:", json);

            const tbody = document.getElementById('clientsTableBody');
            const emptyState = document.getElementById('clientsEmptyState');
            tbody.innerHTML = '';

            if (!json.success || !json.data || json.data.length === 0) {
                emptyState.style.display = 'block';
                return;
            }
            emptyState.style.display = 'none';

            json.data.forEach(client => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${client.first_name} ${client.last_name}</td>
                    <td>${client.phone}</td>
                    <td>${client.email}</td>
                    <td>-</td>
                    <td>-</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
            renderEmptyState('clientsTableBody', 'clientsEmptyState', 'Backend not connected');
        }
    }

    // --- Utils ---
    function renderEmptyState(tableId, emptyId, message = null) {
        const tbody = document.getElementById(tableId);
        if (tbody) tbody.innerHTML = '';
        const empty = document.getElementById(emptyId);
        if (empty) {
            empty.style.display = 'block';
            if (message) empty.querySelector('p').textContent = message;
        }
    }
});
