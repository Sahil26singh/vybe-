# 🌊 Vybe — Full-Stack AI-Powered Social Platform

Vybe is a modern, real-time social networking web application designed and built on the **MERN stack** (MongoDB, Express.js, React 19, Node.js). 

It combines traditional social features—like posting, liking, commenting, and real-time chat—with **Google Gemini AI** for semantic vector recommendations, automated vision captioning, accessibility alt-text generation, and AI safety moderation.

---

## 📸 Key Features & Architecture Highlights

### 🧠 1. AI-Driven User Recommendations (Vector Embeddings & Cosine Similarity)
- **Profile Semantic Indexing**: Aggregates a user's bio, profile metadata, and their 5 most recent post captions into a unified context text string.
- **768-Dim Embeddings**: Generates 768-dimensional L2-normalized vector embeddings via Google's `text-embedding-004` model.
- **Cosine Similarity Ranking**: Real-time vector matching scores candidate profiles against the logged-in user to recommend people with aligned interests.
- **Graceful Fallbacks**: Includes an in-memory deterministic L2 unit-norm feature hashing algorithm if AI API keys are unconfigured or rate-limited.

### ✨ 2. Multimodal AI Vision & Accessibility
- **Automatic Post Caption Generation**: Uses Google Gemini 2.0 Flash Vision AI to analyze uploaded image buffers and generate engaging social captions with emojis and hashtags.
- **Screen Reader Alt-Text (a11y)**: Automatically creates concise, descriptive alt-text for uploaded images to ensure accessibility compliance.
- **AI Content Moderation**: Scans image buffers and text captions for policy violations before storing media or writing to the database.

### ⚡ 3. Low-Latency Real-Time Direct Messaging & Presence
- **Socket.IO Integration**: Persistent bi-directional WebSocket connection for instant 1-on-1 messaging.
- **Live Online Presence**: Tracks active socket connections (`userId -> socketId`) to display real-time online/offline green status indicators.
- **Rich Message Actions**: Supports sending, editing, deleting, and forwarding messages to other users.

### 🔔 4. Real-Time Notification Engine
- **Instant Alerts**: Emits socket events for likes, comments, and new followers.
- **Synced Unread Badge Count**: App-wide unread badge counter synchronized across components using React Context API.

### 🛡️ 5. Security & Performance Engineering
- **HTTP-Only JWT Cookies**: Authentication tokens are stored in `HttpOnly`, `SameSite` cookies to prevent Cross-Site Scripting (XSS) token theft.
- **In-Memory Image Compression**: Resizes and compresses image buffers using `sharp` (JPEG quality 80, max 800x800) before uploading to Cloudinary to save network bandwidth.
- **Database Query Optimizations**: Uses `.lean()` for faster POJO queries, `$in` batch operators to eliminate N+1 query loops, and atomic `$addToSet`/`$pull` operators for race-condition-free likes.
- **ReDoS Sanitization**: Escapes user search inputs to prevent Regular Expression Denial of Service attacks during username lookups.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS, Radix UI Primitives, Lucide Icons
- **HTTP Client**: Axios (custom instance with `withCredentials: true` and 401 response interceptors)
- **State & Routing**: React Context API (`AppContext`), React Router DOM v7
- **Real-Time Client**: `socket.io-client`
- **Path Aliasing**: `@/*` mapped to `./src/*`

### Backend
- **Runtime**: Node.js & Express 5
- **Database**: MongoDB Atlas with Mongoose ODM
- **Real-Time Engine**: Socket.IO Server
- **AI Models**: Google Generative AI SDK (`text-embedding-004`, `gemini-2.0-flash`)
- **Media & Uploads**: Cloudinary API, Multer, Sharp image processor
- **Auth & Security**: JWT (`jsonwebtoken`), BcryptJS, Cookie Parser

---

## 📂 Project Structure

```
vybe/
├── backend/
│   ├── controllers/         # Request handlers (user, post, message, notification)
│   ├── middlewares/         # Authentication & security guards
│   ├── models/              # Mongoose schemas (User, Post, Message, Conversation, Notification, Comment)
│   ├── routes/              # Express API route declarations
│   ├── socket/              # Socket.IO connection manager & presence map
│   ├── utils/               # Gemini AI SDK helpers, Cloudinary config, Data URI transformers
│   └── server.js            # Node.js server entry point
│
└── frontend/
    ├── src/
    │   ├── components/      # React UI components (ChatPage, MainLayout, Navbar, Post, etc.)
    │   ├── context/         # AppContext (Global State, Socket lifecycle, Auth, Chat)
    │   ├── lib/             # Axios instance, Tailwind merge utilities
    │   ├── App.jsx          # Root application routing
    │   └── main.jsx         # React DOM root entry point
    ├── vite.config.js       # Vite bundler & @ path alias configuration
    └── jsconfig.json        # VS Code IntelliSense path mapping
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18+` or `v20+`
- **MongoDB Atlas** database URI
- **Cloudinary** account credentials
- **Google Gemini API Key** *(optional; fallback algorithms included)*

---

### Environment Setup

Create a `.env` file in the root directory:

```env
PORT=8000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/vybe
SECRET_KEY=your_super_secret_jwt_key
CLOUD_NAME=your_cloudinary_cloud_name
API_KEY=your_cloudinary_api_key
API_SECRET=your_cloudinary_api_secret
GEMINI_API_KEY=your_gemini_api_key
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8000
NODE_ENV=development
```

---

### Installation & Execution

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Sahil26singh/vybe-.git
   cd vybe-
   ```

2. **Install Server & Client Dependencies**:
   ```bash
   # Install backend dependencies
   npm install

   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

3. **Run in Development Mode**:
   ```bash
   # Terminal 1: Start Backend Server (Port 8000)
   npm run dev

   # Terminal 2: Start Frontend Dev Server (Port 5173)
   cd frontend
   npm run dev
   ```

4. **Build & Run Production Mode**:
   ```bash
   # Build frontend assets into backend/public
   npm run build

   # Start production server
   npm start
   ```

---

## 📡 API Reference Overview

| Domain | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/user/register` | Create a new user account |
| **Auth** | `POST` | `/api/v1/user/login` | Log in & set HTTP-only JWT cookie |
| **Auth** | `GET` | `/api/v1/user/logout` | Clear session cookie |
| **User** | `GET` | `/api/v1/user/suggested` | Vector search similarity recommendation |
| **User** | `POST` | `/api/v1/user/profile/edit` | Update bio, gender, & profile picture |
| **Posts** | `POST` | `/api/v1/post/addpost` | Upload post with image & optional caption |
| **Posts** | `POST` | `/api/v1/post/generate-caption` | Generate AI caption from image buffer |
| **Posts** | `GET` | `/api/v1/post/all` | Fetch feed posts sorted by newest |
| **Posts** | `GET` | `/api/v1/post/:id/like` | Like a post |
| **Posts** | `GET` | `/api/v1/post/:id/dislike` | Dislike / remove like from a post |
| **Messages**| `POST` | `/api/v1/message/send/:id` | Send direct message |
| **Messages**| `GET` | `/api/v1/message/all/:id` | Get message history with user |
| **Messages**| `POST` | `/api/v1/message/forward/:id`| Forward message to another user |
| **Notifs** | `GET` | `/api/v1/notification` | Fetch user notifications & unread count |

---

## 📜 License

Distributed under the MIT License. Built by [Sahil Singh](https://github.com/Sahil26singh).
