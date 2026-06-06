# Q-Less: Virtual Queue Management System – Project Report

## 1. Project Overview
Q-Less is a full-stack, AI-powered Virtual Queue Management System built designed to manage patient flows efficiently in healthcare facilities. It dynamically predicts the appropriate department based on user-entered symptoms, orchestrates multiple virtual queues via Redis, and provides real-time web socket updates for queue tracking.

## 2. Technology Stack
**Frontend:**
* React.js (Vite)
* Tailwind CSS (Styling, animations, glassmorphism)
* Recharts (Admin analytics)
* Socket.io-client

**Backend:**
* Node.js + Express
* JWT Authentication & Bcrypt Hashing
* Multer for Document Uploads

**Database & Cache:**
* MongoDB (Mongoose Schema mapping)
* Redis (Lightning-fast queue enqueue/dequeue manipulation)

**AI Module:**
* Python Flask
* Symptom classification logic

**Real-Time Integration:**
* Socket.io WebSockets

## 3. Database Schema Design (MongoDB)
* **Users Collection**: Stores user information (`_id, name, email, password, role, createdAt`).
* **QueueTokens Collection**: Stores the active queue tokens (`_id, userId, department, urgency, status, issues, position, estimatedWaitTime`).
* **Documents Collection**: Records uploaded prescriptions/records (`_id, userId, filename, path, mimetype`).

## 4. API Endpoints
### Backend (Node.js/Express - Port 8000)
- `POST /api/auth/register` - Create user
- `POST /api/auth/login` - Authenticate and return JWT
- `POST /api/queue/join` - Add token to DB & Redis list
- `GET /api/queue/status/:tokenId` - Get real-time queue position
- `GET /api/queue/all` - Admin analytics fetch
- `POST /api/queue/serve/:department` - Admin dequeue head of Redis list
- `POST /api/upload` - Store file locally via Multer

### AI Engine (Flask - Port 5000)
- `POST /predict` - Accepts `{ "symptoms": string }`, returns `{ "department": string, "urgency": "Low|Medium|High|Emergency" }`

## 5. Distinct System Features
1. **Dynamic Priority Queue**: Identifies emergency situations using AI and bumps users to priority (`LPUSH` vs `RPUSH` in Redis).
2. **"Leave Now!" Alerts**: Once a patient reaches position 2 or below, a WebSocket event is fired notifying them directly to their Dashboard to head to the hospital.
3. **Admin Dashboard Analytics**: React Recharts visualize live queue loads dynamically across different departments.
