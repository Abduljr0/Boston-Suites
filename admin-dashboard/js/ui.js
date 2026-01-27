// ============================================================================
// GLOBAL API CONFIGURATION
// ============================================================================
// Read API base URL from global config injected in index.html
// This allows environment-specific configuration without rebuilding JS
const API_BASE = window.__APP_CONFIG__?.API_BASE_URL || "http://172.23.89.211:5005/api/v1";
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

    // --- Initialization ---
    initNavigation();
    initTheme();
    initRoomsModule();
    initRevenueModule();
    initAvailabilityModule();
    initBookingModule();

    // Initial load for dashboard
    loadDashboardStats();

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

            // Derive occupancy (ACTIVE bookings today)
            const today = new Date().toISOString().split('T')[0];
            const activeBookings = bookings.filter(b => b.check_in <= today && b.check_out > today && b.status !== 'CANCELLED');
            document.getElementById('stat-occupied').textContent = activeBookings.length;
            document.getElementById('stat-available').textContent = rooms.filter(r => r.status === 'ACTIVE').length - activeBookings.length;

            const checkinsToday = bookings.filter(b => b.check_in === today).length;
            const checkoutsToday = bookings.filter(b => b.check_out === today).length;

            document.getElementById('stat-checkins').textContent = checkinsToday;
            document.getElementById('stat-checkouts').textContent = checkoutsToday;

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
            document.querySelector('.menu-item[data-target="view-book-room"]').click();
            const bookForm = document.getElementById('bookRoomForm');
            bookForm.querySelector('input[readonly]').value = `${room.number} - ${room.type} ($${room.price})`;
            bookForm.dataset.roomId = room.id;
        }));
    }

    // --- Bookings Module ---
    function initBookingModule() {
        const form = document.getElementById('bookRoomForm');
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const roomId = form.dataset.roomId;
            if (!roomId) return alert('Please select a room first');

            const payload = {
                room_id: roomId,
                client_name: form.querySelector('input[placeholder="Full Name"]').value,
                phone: form.querySelector('input[type="tel"]').value,
                check_in: form.querySelector('input[type="date"]').value,
                nights: parseInt(form.querySelector('input[type="number"]').value)
            };

            try {
                const res = await fetch(`${API_BASE}/bookings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (json.success) {
                    alert('Booking Confirmed!');
                    form.reset();
                    delete form.dataset.roomId;
                } else {
                    alert('Error: ' + json.error);
                }
            } catch (err) { console.error(err); }
        });
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
                tr.innerHTML = `
                    <td>#BK-${bk.id.substring(0, 8)}</td>
                    <td>${bk.first_name} ${bk.last_name}</td>
                    <td>${bk.room_number} (${bk.room_name || bk.room_type || ''})</td>
                    <td>${bk.check_in}</td>
                    <td>${bk.check_out}</td>
                    <td><span class="status-badge status-active">${bk.status}</span></td>
                    <td><button class="btn btn-outline"><i class="fas fa-eye"></i></button></td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
            renderEmptyState('bookingsTableBody', 'bookingsEmptyState', 'Backend not connected');
        }
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
