# Boston Suites - Environment Configuration Guide

## 🌍 Global Backend-Frontend Connection Architecture

This system uses **runtime configuration** to enable environment-agnostic deployment without rebuilding JavaScript files.

---

## 📋 Configuration Overview

### Frontend Configuration Location
**File:** `admin-dashboard/index.html`

```html
<script>
    window.__APP_CONFIG__ = {
        API_BASE_URL: "http://localhost:5005/api/v1",
        ENVIRONMENT: "development",
        DEBUG: true
    };
</script>
```

### Backend Configuration
**File:** `server/server.js`
- Listens on `0.0.0.0` (all network interfaces)
- Default port: `5005`
- CORS enabled for all origins (development)

---

## 🔧 Environment-Specific Configurations

### 1. Local Development (Windows)

**Frontend (`index.html`):**
```javascript
window.__APP_CONFIG__ = {
    API_BASE_URL: "http://localhost:5005/api/v1",
    ENVIRONMENT: "development",
    DEBUG: true
};
```

**Backend:** No changes needed - runs on `localhost:5005`

---

### 2. WSL + Windows Browser

**Step 1: Get WSL IP Address**
```bash
# Run in WSL terminal
ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1
# Example output: 172.23.89.211
```

**Step 2: Update Frontend (`index.html`):**
```javascript
window.__APP_CONFIG__ = {
    API_BASE_URL: "http://localhost:5005/api/v1",  // ← Use WSL IP
    ENVIRONMENT: "development",
    DEBUG: true
};
```

**Step 3: Verify Backend Binding**
Backend automatically binds to `0.0.0.0:5005` (all interfaces)

**Step 4: Test Connection**
```bash
# From Windows PowerShell
curl http://localhost:5005/api/v1/health
```

---

### 3. Staging Environment

**Frontend (`index.html`):**
```javascript
window.__APP_CONFIG__ = {
    API_BASE_URL: "https://staging-api.bostonsuites.com/api/v1",
    ENVIRONMENT: "staging",
    DEBUG: false
};
```

**Backend:**
- Deploy with reverse proxy (nginx/Apache)
- Enable HTTPS
- Restrict CORS to staging domain

---

### 4. Production Environment

**Frontend (`index.html`):**
```javascript
window.__APP_CONFIG__ = {
    API_BASE_URL: "https://api.bostonsuites.com/api/v1",
    ENVIRONMENT: "production",
    DEBUG: false
};
```

**Backend:**
- Use environment variables:
  ```bash
  export NODE_ENV=production
  export PORT=5005
  export HOST=0.0.0.0
  ```
- Configure CORS for production domain only
- Enable rate limiting and security headers

---

## ✅ Validation Checklist

### Frontend Validation
- [ ] Open browser console (F12)
- [ ] Look for: `🔧 Boston Suites Admin Dashboard`
- [ ] Verify: `📡 API Base URL: http://...`
- [ ] Check: No hard-coded `localhost` in Network tab

### Backend Validation
```bash
# Health check
curl http://localhost:5005/api/v1/health

# Expected response:
{
  "status": "ok",
  "service": "Boston Suites API",
  "environment": "development",
  "uptime": 123.45
}
```

### Network Validation
```bash
# Check backend is listening on all interfaces
netstat -ano | findstr :5005

# Should show:
# TCP    0.0.0.0:5005           0.0.0.0:0              LISTENING
```

---

## 🐛 Troubleshooting

### Issue: "Backend connection failed"

**Check 1: Backend Running?**
```bash
curl http://localhost:5005/api/v1/health
```

**Check 2: Correct API URL?**
- Open browser console
- Look for: `🔍 API Base URL: ...`
- Verify it matches backend address

**Check 3: CORS Enabled?**
- Backend must have `app.use(cors())`
- Check browser console for CORS errors

**Check 4: Firewall (WSL)?**
```powershell
# Windows PowerShell (Admin)
New-NetFirewallRule -DisplayName "WSL API" -Direction Inbound -LocalPort 5005 -Protocol TCP -Action Allow
```

---

### Issue: WSL IP Changed

WSL IP addresses can change on reboot. To fix:

1. Get new IP:
   ```bash
   ip addr show eth0 | grep 'inet '
   ```

2. Update `index.html`:
   ```javascript
   API_BASE_URL: "http://NEW_IP:5005/api/v1"
   ```

3. Hard refresh browser: `Ctrl + Shift + R`

---

## 🚀 Quick Start Commands

### Start Backend
```bash
cd "c:\My Web Sites\Boston suites\Boston-Suites\server"
bash -c "node server.js"
```

### Start Frontend
```bash
cd "c:\My Web Sites\Boston suites\Boston-Suites"
python -m http.server 8081
```

### Access Dashboard
```
http://localhost:8081/admin-dashboard/index.html
```

---

## 📊 Configuration Matrix

| Environment | Frontend URL | Backend URL | DEBUG | CORS |
|-------------|--------------|-------------|-------|------|
| Local | `localhost:8081` | `localhost:5005` | ✅ | `*` |
| WSL | `localhost:8081` | `WSL_IP:5005` | ✅ | `*` |
| Staging | `staging.domain.com` | `staging-api.domain.com` | ❌ | Restricted |
| Production | `app.domain.com` | `api.domain.com` | ❌ | Restricted |

---

## 🔒 Security Notes

### Development
- CORS: Open to all origins (`*`)
- DEBUG: Enabled (verbose logging)
- HTTP: Acceptable

### Production
- CORS: Restrict to production domain
- DEBUG: Disabled
- HTTPS: **Required**
- Add rate limiting
- Add authentication/authorization
- Use environment variables (never commit secrets)

---

## 📝 Best Practices

1. **Never hard-code URLs in JavaScript**
   - ❌ `fetch('http://localhost:5005/api/v1/rooms')`
   - ✅ `fetch(`${API_BASE}/rooms`)`

2. **Always use global config**
   ```javascript
   const API_BASE = window.__APP_CONFIG__?.API_BASE_URL || "fallback";
   ```

3. **Validate HTTP responses**
   ```javascript
   if (!response.ok) {
       throw new Error(`HTTP ${response.status}`);
   }
   ```

4. **Handle errors gracefully**
   - Log to console with context
   - Show user-friendly messages
   - Provide empty states

5. **Test across environments**
   - Local → WSL → Staging → Production
   - Verify each configuration works

---

## 🎯 Success Criteria

✅ Frontend loads without console errors  
✅ Network tab shows real API calls  
✅ No `localhost` references in production  
✅ API base URL changeable without rebuilding  
✅ Works in WSL + Windows browser  
✅ Health check endpoint responds  
✅ CORS configured correctly  
✅ Error handling displays helpful messages  

---

## 📞 Support

For configuration issues:
1. Check browser console (F12)
2. Verify backend health: `/api/v1/health`
3. Review this guide's troubleshooting section
4. Check network tab for failed requests
