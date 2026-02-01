/**
 * Login Logic for Boston Suites
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const themeToggle = document.getElementById('themeToggle');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');

    // Theme Management
    const initTheme = () => {
        const savedTheme = localStorage.getItem('boston-suites-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    };

    const updateThemeIcon = (theme) => {
        const icon = themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    };

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('boston-suites-theme', newTheme);
        updateThemeIcon(newTheme);
    });

    initTheme();

    // Login Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Reset UI
        loginError.style.display = 'none';
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${window.__APP_CONFIG__.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (result.success) {
                // Store auth state
                localStorage.setItem('boston_suites_auth', JSON.stringify({
                    token: result.data.token,
                    user: result.data.user,
                    loginTime: new Date().getTime()
                }));

                // Redirect to dashboard
                // Using a small delay for a better UX transition
                setTimeout(() => {
                    window.location.href = '../admin-dashboard/index.html';
                }, 800);
            } else {
                showError(result.error || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Unable to connect to the server. Please check your internet connection.');
        } finally {
            if (!loginError.style.display || loginError.style.display === 'none') {
                // Only reset if not redirected
                setTimeout(() => {
                    btnText.style.display = 'inline-block';
                    btnLoader.style.display = 'none';
                    submitBtn.disabled = false;
                }, 500);
            } else {
                btnText.style.display = 'inline-block';
                btnLoader.style.display = 'none';
                submitBtn.disabled = false;
            }
        }
    });

    const showError = (message) => {
        loginError.textContent = message;
        loginError.style.display = 'block';
    };

    // Check if already authenticated
    const auth = JSON.parse(localStorage.getItem('boston_suites_auth'));
    if (auth && auth.token) {
        // Simple verification - if auth exists, redirect to dashboard
        window.location.href = '../admin-dashboard/index.html';
    }
});
