// mock-api.js - In‑memory data and API functions for Boston Suites admin dashboard

window.mockAPI = (function () {
    // Sample data
    const rooms = [
        { id: 101, type: "1 Bedroom", basePrice: 120, status: "Available" },
        { id: 102, type: "2 Bedroom", basePrice: 180, status: "Available" },
        { id: 201, type: "Suite", basePrice: 300, status: "Available" },
        // Add more rooms as needed
    ];

    const bookings = [
        // Example booking
        // { id: 1, roomId: 101, clientId: 1, checkIn: "2026-02-01", nights: 3, status: "Reserved" },
    ];

    const clients = [
        // { id: 1, name: "John Doe", phone: "555‑1234" },
    ];

    // Helper to generate unique IDs
    let nextBookingId = 1;

    function getData() {
        return { rooms, bookings, clients };
    }

    // Availability engine
    function getAvailableRooms(roomType, checkIn, nights) {
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkIn);
        checkOutDate.setDate(checkOutDate.getDate() + nights);
        return rooms.filter(r => {
            if (roomType && r.type !== roomType) return false;
            // Check for overlapping bookings
            const overlap = bookings.some(b => {
                if (b.roomId !== r.id) return false;
                const bStart = new Date(b.checkIn);
                const bEnd = new Date(b.checkIn);
                bEnd.setDate(bEnd.getDate() + b.nights);
                return (checkInDate < bEnd) && (checkOutDate > bStart);
            });
            return !overlap && r.status === "Available";
        });
    }

    // Create a new booking (basic validation)
    function createBooking({ roomId, clientId, checkIn, nights, priceOverride }) {
        // Ensure room exists and is available
        const available = getAvailableRooms(null, checkIn, nights).some(r => r.id === roomId);
        if (!available) {
            throw new Error("Room not available for the selected dates");
        }
        const newBooking = {
            id: nextBookingId++,
            roomId,
            clientId,
            checkIn,
            nights,
            status: "Reserved",
            totalCost: calculateTotalCost(roomId, nights, priceOverride),
            priceOverride: priceOverride || null,
        };
        bookings.push(newBooking);
        // Log action (simple console log for demo)
        console.log("Booking created", newBooking);
        return newBooking;
    }

    function calculateTotalCost(roomId, nights, priceOverride) {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return 0;
        const base = priceOverride !== undefined ? priceOverride : room.basePrice;
        return base * nights;
    }

    // Expose API
    return {
        getData,
        getAvailableRooms,
        createBooking,
        calculateTotalCost,
    };
})();
