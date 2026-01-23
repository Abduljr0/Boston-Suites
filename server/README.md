# Boston Suites API Server

This is the backend server for the Boston Suites Admin System.

## Prerequisites
You need **Node.js** installed to run this server.
Download it from: [https://nodejs.org/](https://nodejs.org/)

## Setup
1. Open a terminal in this directory (`server/`).
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Server
Start the server:
```bash
node server.js
```
The API will be available at: `http://localhost:3000`

## Database
The server uses **SQLite**. A file named `boston_suites.db` will be automatically created in this directory upon the first run.

## API Endpoints
See `../design/backend_api_design.md` for full documentation.
- `GET /api/v1/rooms`
- `POST /api/v1/availability/check`
- `POST /api/v1/bookings`
