// app.js - Admin Dashboard Interaction

// Simple in-memory data (populated by mock-api.js)
let data = {};

// Load mock data
function loadData() {
  if (window.mockAPI && typeof window.mockAPI.getData === 'function') {
    data = window.mockAPI.getData();
    renderDashboard();
  } else {
    console.error('mockAPI not available');
  }
}

// Render simple dashboard overview
function renderDashboard() {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard) return;
  const { rooms, bookings } = data;
  const today = new Date().toISOString().slice(0, 10);
  const todayCheckIns = bookings.filter(b => b.checkIn === today);
  const todayCheckOuts = bookings.filter(b => {
    const checkout = new Date(b.checkIn);
    checkout.setDate(checkout.getDate() + b.nights);
    return checkout.toISOString().slice(0, 10) === today;
  });
  const occupied = bookings.filter(b => {
    const checkIn = new Date(b.checkIn);
    const checkout = new Date(b.checkIn);
    checkout.setDate(checkout.getDate() + b.nights);
    const now = new Date();
    return now >= checkIn && now < checkout;
  }).length;
  const totalRooms = rooms.length;
  const occupancyRate = ((occupied / totalRooms) * 100).toFixed(1);

  dashboard.innerHTML = `
    <div class="card">
      <h2>Today</h2>
      <p>Check‑ins: ${todayCheckIns.length}</p>
      <p>Check‑outs: ${todayCheckOuts.length}</p>
    </div>
    <div class="card">
      <h2>Occupancy</h2>
      <p>${occupied} / ${totalRooms} rooms occupied (${occupancyRate}%)</p>
    </div>
  `;
}

// Initialize after DOM ready
document.addEventListener('DOMContentLoaded', loadData);
