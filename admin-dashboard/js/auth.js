/**
 * Authentication and Session Management for Boston Suites Admin Dashboard
 */

(function () {
    // 1. Route Protection
    const checkAuth = () => {
        const auth = JSON.parse(localStorage.getItem('boston_suites_auth'));

        // If no auth or token is missing, redirect to login
        if (!auth || !auth.token) {
            console.log('No authentication found. Redirecting to login...');
            // Calculate path back to login
            window.location.href = '../../login/index.html';
            return false;
        }

        // Optional: Check session expiration (e.g., 24 hours)
        const now = new Date().getTime();
        const sessionAge = now - (auth.loginTime || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (sessionAge > maxAge) {
            console.log('Session expired. Redirecting to login...');
            logout();
            return false;
        }

        // Update UI with user info
        updateUserUI(auth.user);
        return true;
    };

    const updateUserUI = (user) => {
        document.addEventListener('DOMContentLoaded', () => {
            const userInfoElements = document.querySelectorAll('.user-info span');
            if (userInfoElements.length > 0) {
                userInfoElements[0].textContent = user.full_name || user.username;
            }

            const avatarElements = document.querySelectorAll('.user-avatar');
            if (avatarElements.length > 0) {
                avatarElements[0].textContent = (user.full_name || user.username).charAt(0).toUpperCase();
            }
        });
    };

    const logout = () => {
        console.log('Logging out...');
        localStorage.removeItem('boston_suites_auth');
        window.location.href = '../../login/index.html';
    };

    // Run auth check immediately (even before DOM is ready to prevent flash of content)
    if (!checkAuth()) return;

    // 2. Initialize Logout Listeners
    document.addEventListener('DOMContentLoaded', () => {
        const logoutNav = document.getElementById('nav-logout');
        const logoutTop = document.getElementById('top-bar-logout');

        if (logoutNav) logoutNav.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) logout();
        });

        if (logoutTop) logoutTop.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) logout();
        });
    });

    // Handle Theme alignment
    const syncTheme = () => {
        const savedTheme = localStorage.getItem('boston-suites-theme');
        if (savedTheme) {
            localStorage.setItem('admin-theme', savedTheme);
        }
    };

    syncTheme();

})();
