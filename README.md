# 🌊 Vybe — Full-Stack AI-Powered Social Platform

Vybe is a modern, real-time social networking web application built on the MERN stack with integrated **Gemini AI Vector Search**, **AI Vision Caption Generation**, and **Socket.IO Real-Time Messaging**.

![Vybe Platform](https://img.shields.io/badge/MERN-Stack-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![Express](https://img.shields.io/badge/Express-5.1-000000?style=for-the-badge&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)
![Socket.IO](https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socketdotio)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI_Vector_Search-8E75B2?style=for-the-badge&logo=googlegemini)

---

## ✨ Key Features

- 🧠 **Gemini AI Vector Search User Recommendations**:
  - Generates 768-dimensional L2-normalized text vector embeddings representing user bios, posts, and interests.
  - Ranks candidate suggestions in real-time using **Cosine Similarity** vector matching.

- ✨ **Multimodal AI Post Caption Generator**:
  - Automatically inspects uploaded images using Google Gemini 2.0 Flash Vision AI.
  - Generates aesthetic social media captions complete with emojis and trending hashtags.

- ⚡ **Real-Time Direct Messaging & Online Presence**:
  - Low-latency chat powered by Socket.IO.
  - Live green-dot online/offline user status indicators.
  - Share posts and forward messages directly to connections.

- 🔔 **Real-Time Synced Notification Engine**:
  - Instant notifications for likes, comments, and new followers.
  - App-wide unread badge count synchronized seamlessly across components.

- 🛡️ **Authentication & Media**:
  - Secure JWT authentication with HTTP-only cookies.
  - Cloudinary integration for image uploads and optimizations.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, Radix UI, Lucide React, Axios, React Context API |
| **Backend** | Node.js, Express 5, Mongoose ODM, Socket.IO, Sharp |
| **Database** | MongoDB Atlas (Vector Feature Storage) |
| **AI Services** | Google Generative AI SDK (`text-embedding-004`, `gemini-2.0-flash`) |
| **Storage & Auth** | Cloudinary, JWT, BcryptJS, Cookie Parser |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18+` or `v20+`
- **MongoDB Atlas** database URI
- **Google Gemini API Key** (optional, fallback feature vectors included)
- **Cloudinary** credentials

---

### Installation & Environment Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Sahil26singh/vybe-.git
   cd vybe-
   ```

2. **Install Dependencies**:
   ```bash
   # Install backend dependencies
   npm install

   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory (`c:/cppvsdev/vybe/.env`):

   ```env
   PORT=8000
   MONGO_URI=your_mongodb_connection_string
   SECRET_KEY=your_jwt_secret_key
   CLOUD_NAME=your_cloudinary_cloud_name
   API_KEY=your_cloudinary_api_key
   API_SECRET=your_cloudinary_api_secret
   GEMINI_API_KEY=your_gemini_api_key
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8000
   ```

---

### Running the Application

- **Development Mode**:
  ```bash
  # Start Backend API & Socket Server (Port 8000)
  npm run dev

  # Start Frontend Vite Dev Server (Port 5173) in a second terminal
  cd frontend
  npm run dev
  ```

- **Production Build & Single-Service Execution**:
  ```bash
  # Build frontend & bundle assets
  npm run build

  # Start production server
  npm start
  ```

---

## 📡 API Endpoint Overview

| Module | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/user/register` | Register a new user |
| **Auth** | `POST` | `/api/v1/user/login` | Log in and receive HTTP-only JWT |
| **AI Vector** | `GET` | `/api/v1/user/suggested` | Rank candidate users by 768-dim Vector Cosine Similarity |
| **AI Vision** | `POST` | `/api/v1/post/generate-caption` | Generate AI caption from image buffer |
| **Posts** | `POST` | `/api/v1/post/addpost` | Upload a new post |
| **Posts** | `GET` | `/api/v1/post/all` | Fetch feed posts |
| **Messages** | `POST` | `/api/v1/message/send/:id` | Send a direct message |
| **Notifications**| `GET` | `/api/v1/notification` | Fetch user notifications & unread counts |

---

## 📝 License

Distributed under the ISC License. See `LICENSE` for more information.
