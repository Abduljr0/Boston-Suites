# Boston Suites - Quick Reference Card

## 🚀 Start the System

### Backend (Terminal 1)
```bash
cd "c:\My Web Sites\Boston suites\Boston-Suites\server"
bash -c "node server.js"
```
**Expected:** `🚀 Boston Suites API Server` + `✅ Server ready for connections`

### Frontend (Terminal 2)
```bash
cd "c:\My Web Sites\Boston suites\Boston-Suites"
python -m http.server 8081
```
**Expected:** `Serving HTTP on :: port 8081`

### Access Dashboard
```
http://localhost:8081/admin-dashboard/index.html
```

---

## 🔧 Change API Endpoint

**File:** `admin-dashboard/index.html` (line ~650)

```javascript
window.__APP_CONFIG__ = {
    API_BASE_URL: "http://YOUR_IP:5005/api/v1",  // ← Change this
    ENVIRONMENT: "development",
    DEBUG: true
};
```

**No JavaScript rebuild needed!** Just edit and refresh browser.

---

## 🧪 Quick Tests

### Health Check
```bash
curl http://localhost:5005/api/v1/health
```
**Expected:** `{"status":"ok","service":"Boston Suites API",...}`

### Rooms API
```bash
curl http://localhost:5005/api/v1/rooms
```
**Expected:** `{"success":true,"data":[...]}`

### Frontend Console
1. Open dashboard
2. Press `F12`
3. Look for:
   - `🔧 Boston Suites Admin Dashboard`
   - `📡 API Base URL: http://...`
   - `✅ Dashboard API data loaded`

---

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Kill existing processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Restart
cd server
bash -c "node server.js"
```

### Frontend Shows Errors
1. Check browser console (F12)
2. Look for `❌ Backend connection failed`
3. Verify backend is running: `curl http://localhost:5005/api/v1/health`
4. Check API_BASE_URL in `index.html` matches backend

### WSL IP Changed
```bash
# Get new IP
ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1

# Update index.html with new IP
# Hard refresh browser: Ctrl + Shift + R
```

---

## 📊 Port Reference

| Service | Port | URL |
|---------|------|-----|
| Backend API | 5005 | http://localhost:5005 |
| Frontend | 8081 | http://localhost:8081 |
| Health Check | 5005 | http://localhost:5005/api/v1/health |

---

## 🔍 Common Commands

### Check Backend Status
```bash
netstat -ano | findstr :5005
```

### Check Frontend Status
```bash
netstat -ano | findstr :8081
```

### View Backend Logs
Check the terminal where `node server.js` is running

### Clear Browser Cache
`Ctrl + Shift + Delete` or Hard Refresh: `Ctrl + Shift + R`

---

## 📚 Documentation

- **Full Config Guide:** `ENVIRONMENT_CONFIG.md`
- **Deployment Steps:** `DEPLOYMENT_CHECKLIST.md`
- **Implementation Details:** `IMPLEMENTATION_SUMMARY.md`
- **Quick Start:** `QUICKSTART.md`

---

## ✅ System Status Indicators

### Backend Healthy
```
🚀 Boston Suites API Server
📡 Listening on: http://0.0.0.0:5005
✅ Server ready for connections
```

### Frontend Healthy
```javascript
// Browser Console:
🔧 Boston Suites Admin Dashboard
📡 API Base URL: http://localhost:5005/api/v1
🌍 Environment: development
✅ Dashboard API data loaded: {...}
```

### System Working
- Dashboard loads without errors
- Stats show numbers (not `—`)
- Tables populate with data
- No red errors in console

---

## 🎯 Environment Configs

### Local
```javascript
API_BASE_URL: "http://localhost:5005/api/v1"
```

### WSL
```javascript
API_BASE_URL: "http://172.x.x.x:5005/api/v1"  // Your WSL IP
```

### Production
```javascript
API_BASE_URL: "https://api.bostonsuites.com/api/v1"
```

---

**Last Updated:** 2026-01-27  
**Version:** 1.0.0
