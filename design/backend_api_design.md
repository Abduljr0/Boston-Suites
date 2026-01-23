# Boston Suites Backend API Design

This document outlines the architectural design for the Boston Suites Booking System API. It follows an API-first, stateless, and modular approach.

## 📦 Global Standards

### Response Structure
All API responses MUST follow this envelope:

```json
{
  "success": boolean,
  "data": object | null,
  "error": {
    "code": "string",
    "message": "string",
    "details": object | null // Optional validation errors
  } | null
}
```

### Common HTTP Status Codes
- `200 OK`: Successful synchronous operation.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Validation failure.
- `401 Unauthorized`: Authentication missing.
- `403 Forbidden`: Authenticated but permissions missing.
- `404 Not Found`: Resource does not exist.
- `409 Conflict`: Resource state conflict (e.g., double booking).
- `500 Internal Server Error`: Unhandled system error.

---

## 🔹 MODULE 1: Room & Room Type Logic

### 1. List Room Types
Returns definitions of all room categories (e.g., Luxury Suite, Single).

*   **Endpoint:** `GET /api/v1/room-types`
*   **Response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "rt_123",
          "name": "Luxury Suite",
          "base_price": 250.00,
          "capacity_adults": 2,
          "capacity_children": 1,
          "features": ["Ocean View", "King Bed"]
        }
      ]
    }
    ```

### 2. List Rooms
Returns individual room units.

*   **Endpoint:** `GET /api/v1/rooms`
*   **Query Params:** `?type={roomTypeId}&status={ACTIVE|MAINTENANCE}`
*   **Response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "rm_101",
          "number": "101",
          "type_id": "rt_123",
          "status": "ACTIVE"
        }
      ]
    }
    ```

### 3. Update Room Status
Enable or disable a room (e.g., for maintenance).

*   **Endpoint:** `PATCH /api/v1/rooms/{id}/status`
*   **Request:**
    ```json
    {
      "status": "MAINTENANCE", // or "ACTIVE"
      "reason": "Plumbing repair"
    }
    ```
*   **Validation:**
    *   Cannot disable a room if it has active check-ins for the current date (unless emergency override flag is passed).

---

## 🔹 MODULE 2: Availability Engine (CRITICAL)

### 1. Check Availability
Determines which rooms are free for a specific range.

*   **Endpoint:** `POST /api/v1/availability/check`
*   **Request:**
    ```json
    {
      "room_type_id": "rt_123", /* Optional, valid ID */
      "check_in": "2024-12-25", /* ISO 8601 Date */
      "nights": 3,              /* Integer > 0 */
      "adults": 2,
      "children": 0
    }
    ```
*   **Core Logic:**
    1.  Calculate `check_out` date (`check_in` + `nights`).
    2.  Query `Bookings` table for any records where:
        *   `booking.room_id` matches candidate rooms.
        *   `booking.status` is NOT `CANCELLED`.
        *   Overlap Condition: `check_in < booking.checkout AND check_out > booking.checkin`.
    3.  Filter out rooms found in step 2.
    4.  Filter out rooms where `status != ACTIVE`.
*   **Response:**
    ```json
    {
      "success": true,
      "data": {
        "available_rooms": [
          {
            "id": "rm_101",
            "number": "101",
            "type": "Luxury Suite"
          }
        ],
        "price_breakdown": {
            "base_rate": 250.00,
            "total_estimated": 750.00,
            "currency": "USD"
        }
      }
    }
    ```

---

## 🔹 MODULE 3: Booking Management

### 1. Create Booking
Atomic operation to reserve a room.

*   **Endpoint:** `POST /api/v1/bookings`
*   **Idempotency Key:** `X-Idempotency-Key` header required to prevent double-submit.
*   **Request:**
    ```json
    {
      "room_id": "rm_101",
      "client": {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "phone": "+1234567890" /* Unique Identifier */
      },
      "check_in": "2024-12-25",
      "nights": 3,
      "adults": 2,
      "payment_method": "CASH" /* Initial intent */
    }
    ```
*   **Validation & Logic rules:**
    1.  **Re-Check Availability:** Perform an ACID-compliant check (using database locks or constraints) to ensure the room wasn't snatched milliseconds ago.
    2.  **Client Resolution:** Search client by phone/email. If exists, link ID; otherwise create new Client record.
    3.  **Pricing Snapshot:** Calculate and store the exact price at the moment of booking (immutable).
    4.  **Transaction:** Insert Booking and Client updates in a single transaction.
*   **Response:**
    ```json
    {
      "success": true,
      "data": {
        "booking_id": "bk_999",
        "status": "RESERVED",
        "total_amount": 750.00
      }
    }
    ```

### 2. Cancel Booking
Safely releases inventory.

*   **Endpoint:** `POST /api/v1/bookings/{id}/cancel`
*   **Request:**
    ```json
    {
      "reason": "Customer request"
    }
    ```
*   **Logic:**
    *   Sets status to `CANCELLED`.
    *   Immediately frees up availability for the room/dates.
    *   Logs the cancellation in the Audit trail.

---

## 🔹 MODULE 4: Pricing Engine

### Core Rules
*   **Isolation:** Pricing logic is separate from booking logic. Bookings "consult" the pricing engine but store their own snapshot.
*   **Formula:** `Total = (Base Rate * Nights) + Updates/Taxes`.
*   **Overrides:** Admin can manually set a price during booking creation. This must be stored with a `price_override_reason`.

---

## 🔹 MODULE 5: Client Management

### 1. Search/List Clients
*   **Endpoint:** `GET /api/v1/clients`
*   **Query Params:** `?q=john` (Search by name, phone, or email)
*   **Response:** List of matching clients with summary stats (last stay, total spend).

### Logic
*   **Deduplication:** Primary keys are internal IDs, but logical uniqueness is enforced on Email + Phone normalized.

---

## 🔹 MODULE 6: Payments (Design)

### Concepts
*   **Decoupling:** A Booking exists independently of a Payment.
*   **One-to-Many:** One booking can be paid via multiple partial payments (e.g., Deposit via M-Pesa, Balance via Cash).

### API Contract (Future)
*   `POST /api/v1/payments`: Record a transaction.
    *   Input: `booking_id`, `amount`, `method`, `reference_code` (e.g., M-Pesa code).
*   `GET /api/v1/bookings/{id}/balance`: Calculates `Booking Total - Sum(Approved Payments)`.

---

## 🔹 MODULE 7: Authentication & Audit

### Rules
1.  **Stateless Auth:** JWT (JSON Web Tokens) or similar bearer token passed in `Authorization` header.
2.  **Role-Based Access Control (RBAC):**
    *   `Admin`: Full access.
    *   `Manager`: Can override prices, view audits.
    *   `Staff`: Can book, check-in, view availability. Cannot delete or override prices without approval.
3.  **Audit Logging:**
    *   Every `POST`, `PATCH`, `DELETE` operation triggers a log entry.
    *   Log schema: `timestamp`, `user_id`, `resource`, `action`, `old_value`, `new_value`, `ip_address`.

---

## 🏗️ Scalability & Concurrency Notes

### 1. preventing Double Bookings (Race Conditions)
Checking availability and inserting a booking are two separate steps. In a high-concurrency environment, two requests could check the same room simultaneously, see it empty, and both try to book it.

**Strategy:** Database Constraints or Pessimistic Locking.
*   **Option A (Constraint):** Use an "Exclusion Constraint" (e.g., PostgreSQL `EXCLUDE USING GIST`) on the Booking table for `(room_id, range_dates)`. If two overlap, the DB throws an error, and the API returns `409 Conflict`.
*   **Option B (Locking):** `SELECT ... FOR UPDATE` on the Room row during the booking transaction.

### 2. Caching Availability
Availability queries (`POST /availability/check`) are read-heavy.
*   **Strategy:** Cache raw availability results (e.g., "Room 101 is free Dec 1-30") in Redis.
*   **Invalidation:** Any Booking creation/cancellation event invalidates the cache for that specific room's timeline.

### 3. Database Agnostic
The design focuses on entities and relationships, suitable for SQL (PostgreSQL/MySQL) or NoSQL (with careful handling of transactions). However, **SQL is strongly recommended** due to the relational nature of bookings, inventory, and strict consistency requirements.
