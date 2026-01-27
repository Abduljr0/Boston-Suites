# Boston Suites - Production Deployment Checklist

## ✅ Pre-Deployment Validation

### Backend Validation
- [ ] Health endpoint responds: `curl http://localhost:5005/api/v1/health`
- [ ] Server binds to `0.0.0.0` (check server.js)
- [ ] CORS configured correctly
- [ ] Database migrations complete
- [ ] Environment variables set
- [ ] No hard-coded secrets in code

### Frontend Validation
- [ ] Global config present in `index.html`
- [ ] No hard-coded API URLs in JavaScript
- [ ] All fetch calls use `${API_BASE}`
- [ ] Error handling implemented
- [ ] Empty states render correctly
- [ ] Console shows config on load

### Network Validation
- [ ] Backend accessible from frontend host
- [ ] Firewall rules configured (if needed)
- [ ] HTTPS certificates valid (production)
- [ ] DNS records pointing correctly (production)

---

## 🚀 Deployment Steps

### 1. Local Development
```bash
# Backend
cd server
node server.js

# Frontend
cd ..
python -m http.server 8081
```

**Config (`index.html`):**
```javascript
window.__APP_CONFIG__ = {
    API_BASE_URL: "http://localhost:5005/api/v1",
    ENVIRONMENT: "development",
    DEBUG: true
};
```

---

### 2. WSL Development

**Step 1: Get WSL IP**
```bash
ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1
```

**Step 2: Update Config**
```javascript
window.__APP_CONFIG__ = {
    API_BASE_URL: "http://172.x.x.x:5005/api/v1",  // Your WSL IP
    ENVIRONMENT: "development",
    DEBUG: true
};
```

**Step 3: Allow Firewall (Windows Admin)**
```powershell
New-NetFirewallRule -DisplayName "WSL Boston Suites API" -Direction Inbound -LocalPort 5005 -Protocol TCP -Action Allow
```

---

### 3. Staging Deployment

**Backend:**
```bash
export NODE_ENV=staging
export PORT=5005
export HOST=0.0.0.0
node server.js
```

**Frontend Config:**
```javascript
window.__APP_CONFIG__ = {
    API_BASE_URL: "https://staging-api.bostonsuites.com/api/v1",
    ENVIRONMENT: "staging",
    DEBUG: false
};
```

**Nginx Config (Example):**
```nginx
server {
    listen 443 ssl;
    server_name staging-api.bostonsuites.com;

    location /api/v1 {
        proxy_pass http://localhost:5005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

### 4. Production Deployment

**Backend:**
```bash
export NODE_ENV=production
export PORT=5005
export HOST=0.0.0.0
node server.js
```

**Frontend Config:**
```javascript
window.__APP_CONFIG__ = {
    API_BASE_URL: "https://api.bostonsuites.com/api/v1",
    ENVIRONMENT: "production",
    DEBUG: false
};
```

**Security Hardening:**
1. Restrict CORS to production domain
2. Enable rate limiting
3. Add authentication middleware
4. Use HTTPS only
5. Set security headers
6. Enable logging/monitoring

---

## 🧪 Testing Protocol

### 1. Smoke Test
```bash
# Health check
curl http://localhost:5005/api/v1/health

# Rooms endpoint
curl http://localhost:5005/api/v1/rooms

# Expected: JSON response with success: true
```

### 2. Frontend Integration Test
1. Open dashboard in browser
2. Open DevTools (F12)
3. Check console for:
   - `🔧 Boston Suites Admin Dashboard`
   - `📡 API Base URL: ...`
   - `✅ Dashboard API data loaded`
4. Verify Network tab shows API calls
5. Check dashboard stats populate

### 3. Error Handling Test
1. Stop backend server
2. Refresh dashboard
3. Verify console shows:
   - `❌ Backend connection failed`
   - `🔍 API Base URL: ...`
4. Verify empty states render

### 4. Cross-Environment Test
- [ ] Local works
- [ ] WSL works
- [ ] Staging works
- [ ] Production works

---

## 🔍 Troubleshooting Guide

### Issue: "Backend connection failed"

**Diagnosis:**
```bash
# 1. Is backend running?
curl http://localhost:5005/api/v1/health

# 2. Check process
netstat -ano | findstr :5005

# 3. Check logs
# Look for startup message in terminal
```

**Solution:**
- Restart backend: `node server.js`
- Check firewall settings
- Verify API_BASE_URL in config

---

### Issue: CORS Error

**Symptoms:**
```
Access to fetch at 'http://...' from origin 'http://...' has been blocked by CORS policy
```

**Solution:**
1. Verify backend has `app.use(cors())`
2. For production, configure specific origins:
   ```javascript
   app.use(cors({
       origin: 'https://app.bostonsuites.com'
   }));
   ```

---

### Issue: WSL IP Changed

**Symptoms:**
- Dashboard worked yesterday, not today
- Network errors in console

**Solution:**
1. Get new WSL IP:
   ```bash
   ip addr show eth0 | grep 'inet '
   ```
2. Update `index.html` config
3. Hard refresh: `Ctrl + Shift + R`

---

### Issue: Empty States Always Show

**Diagnosis:**
1. Check browser console for errors
2. Verify API returns data:
   ```bash
   curl http://localhost:5005/api/v1/rooms
   ```
3. Check response format matches expected structure

**Solution:**
- Ensure API returns `{ success: true, data: [...] }`
- Check error handling isn't catching valid responses

---

## 📊 Monitoring Checklist

### Backend Monitoring
- [ ] Health endpoint responding
- [ ] Response times < 500ms
- [ ] No 5xx errors
- [ ] Database connections stable
- [ ] Memory usage normal

### Frontend Monitoring
- [ ] No console errors
- [ ] API calls succeeding
- [ ] UI rendering correctly
- [ ] Empty states when appropriate
- [ ] Error messages helpful

---

## 🔒 Security Checklist

### Development
- [x] CORS: Open (`*`)
- [x] DEBUG: Enabled
- [x] HTTP: Allowed
- [ ] Authentication: Not required

### Production
- [ ] CORS: Restricted to domain
- [ ] DEBUG: Disabled
- [ ] HTTPS: Required
- [ ] Authentication: Implemented
- [ ] Rate limiting: Enabled
- [ ] Security headers: Set
- [ ] Secrets: In environment variables
- [ ] Logging: Enabled
- [ ] Monitoring: Active

---

## 📝 Configuration Files Reference

### Backend: `server/server.js`
```javascript
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 5005;
```

### Frontend: `admin-dashboard/index.html`
```javascript
window.__APP_CONFIG__ = {
    API_BASE_URL: "http://localhost:5005/api/v1",
    ENVIRONMENT: "development",
    DEBUG: true
};
```

### Frontend: `admin-dashboard/js/ui.js`
```javascript
const API_BASE = window.__APP_CONFIG__?.API_BASE_URL || "fallback";
```

---

## 🎯 Success Criteria

✅ Backend starts without errors  
✅ Health endpoint returns 200 OK  
✅ Frontend loads without console errors  
✅ Dashboard stats populate with real data  
✅ Network tab shows successful API calls  
✅ Error handling displays helpful messages  
✅ Empty states render when no data  
✅ Configuration changeable without rebuild  
✅ Works across all target environments  
✅ No hard-coded infrastructure assumptions  

---

## 📞 Emergency Rollback

If deployment fails:

1. **Revert Frontend Config**
   ```javascript
   window.__APP_CONFIG__ = {
       API_BASE_URL: "http://localhost:5005/api/v1",
       ENVIRONMENT: "development",
       DEBUG: true
   };
   ```

2. **Restart Backend**
   ```bash
   cd server
   node server.js
   ```

3. **Clear Browser Cache**
   - `Ctrl + Shift + Delete`
   - Hard refresh: `Ctrl + Shift + R`

4. **Verify Health**
   ```bash
   curl http://localhost:5005/api/v1/health
   ```

---

## 📚 Additional Resources

- **Environment Config Guide:** `ENVIRONMENT_CONFIG.md`
- **Quick Start Guide:** `QUICKSTART.md`
- **API Documentation:** `server/README.md`
- **Frontend Structure:** `admin-dashboard/README.md`

---

**Last Updated:** 2026-01-27  
**Version:** 1.0.0  
**Status:** Production Ready ✅
