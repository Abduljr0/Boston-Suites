# Boston Suites - Quick Start Guide

## Running the Application for Testing

### Prerequisites
- Node.js installed
- Python installed (for frontend server)

### Step 1: Start the Backend API Server

Open a terminal and run:

```bash
cd "c:\My Web Sites\Boston suites\Boston-Suites\server"
bash -c "node server.js"
```

**Expected Output:**
```
Connected to the SQLite database.
Server is running on http://localhost:5005/api/v1/
```

**Backend Port:** `5005`

---

### Step 2: Start the Frontend Web Server

Open a **second terminal** and run:

```bash
cd "c:\My Web Sites\Boston suites\Boston-Suites"
python -m http.server 8081
```

**Expected Output:**
```
Serving HTTP on :: port 8081 (http://[::]:8081/) ...
```

**Frontend Port:** `8081`

---

### Step 3: Access the Dashboard

Open your browser and navigate to:

**🌐 [http://localhost:8081/admin-dashboard/index.html](http://localhost:8081/admin-dashboard/index.html)**

---

## Verification Checklist

✅ **Backend Running:** Visit [http://localhost:5005/api/v1/rooms](http://localhost:5005/api/v1/rooms) - should return JSON data  
✅ **Frontend Serving:** Dashboard loads without errors  
✅ **API Connection:** Dashboard stats show real numbers (not `—`)  
✅ **Console Logs:** Press F12 and check for "Dashboard API data loaded" messages

---

## Troubleshooting

### Port Already in Use Error

If you get `EADDRINUSE` error:

```bash
# Kill all Node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Then restart the backend
cd "c:\My Web Sites\Boston suites\Boston-Suites\server"
bash -c "node server.js"
```

### CORS Errors

Make sure:
- Backend is running on port **5005**
- Frontend is accessing via **http://localhost:8081** (not file://)
- Check `admin-dashboard/js/ui.js` has `API_BASE = 'http://localhost:5005/api/v1'`

---

## Current Configuration

| Component | Port | URL |
|-----------|------|-----|
| Backend API | 5005 | http://localhost:5005/api/v1/ |
| Frontend UI | 8081 | http://localhost:8081/admin-dashboard/ |
| Database | SQLite | server/boston_suites.db |

---

## Quick Commands

**Stop all Node processes:**
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

**Check if ports are in use:**
```powershell
netstat -ano | findstr :5005
netstat -ano | findstr :8081
```

**Test API directly:**
```bash
curl http://localhost:5005/api/v1/rooms
```
