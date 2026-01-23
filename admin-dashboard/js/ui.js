document.addEventListener('DOMContentLoaded', () => {
    // Theme Logic
    window.setTheme = (theme) => {
        const lightBtn = document.getElementById('theme-light-btn');
        const darkBtn = document.getElementById('theme-dark-btn');

        if (theme === 'dark') {
            document.body.classList.add('theme-dark');
            if (lightBtn) lightBtn.classList.remove('active');
            if (darkBtn) darkBtn.classList.add('active');
        } else {
            document.body.classList.remove('theme-dark');
            if (lightBtn) lightBtn.classList.add('active');
            if (darkBtn) darkBtn.classList.remove('active');
        }
    };

    // Sidebar Toggle
    const toggleBtn = document.getElementById('toggleSidebar');
    const sidebar = document.querySelector('.sidebar');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // User Dropdown Toggle
    const userDropdownTrigger = document.getElementById('userDropdownTrigger');
    const userDropdownMenu = document.getElementById('userDropdownMenu');

    if (userDropdownTrigger && userDropdownMenu) {
        userDropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdownMenu.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userDropdownTrigger.contains(e.target) && !userDropdownMenu.contains(e.target)) {
                userDropdownMenu.classList.remove('show');
            }
        });
    }

    // Top Bar Logout
    const topBarLogout = document.getElementById('top-bar-logout');
    if (topBarLogout) {
        topBarLogout.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('isLoggedIn');
            window.location.href = '../home/index.html';
        });
    }

    // Navigation and View Switching
    const menuItems = document.querySelectorAll('.menu-item');
    const views = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('pageTitle');

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Check if disabled
            if (item.classList.contains('disabled')) return;

            // Handle Logout specifically
            if (item.id === 'nav-logout') {
                sessionStorage.removeItem('isLoggedIn');
                window.location.href = '../home/index.html';
                return;
            }

            // Remove active class from all items
            menuItems.forEach(i => i.classList.remove('active'));

            // Add active class to clicked item (if it's a link)
            item.classList.add('active');

            // Hide all views
            views.forEach(view => view.classList.remove('active'));

            // Show target view
            const targetId = item.getAttribute('data-target');
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.classList.add('active');

                // Update Page Title
                const icon = item.querySelector('i').className;
                const text = item.querySelector('span').textContent;
                // pageTitle.textContent = text; // Optional: Update dynamic title if needed
            }
        });
    });

    // Mock functionality for Check Availability
    const checkForm = document.getElementById('checkAvailabilityForm');
    if (checkForm) {
        checkForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const results = document.getElementById('availabilityResults');
            results.style.display = 'none';

            // Simulate loading
            const btn = checkForm.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Checking...';

            setTimeout(() => {
                results.style.display = 'block';
                btn.textContent = originalText;
            }, 800);
        });
    }

    // Mock functionality for Booking Form
    const bookForm = document.getElementById('bookRoomForm');
    if (bookForm) {
        bookForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Booking Saved Successfully! (Simulation)');
            bookForm.reset();
        });
    }
});
