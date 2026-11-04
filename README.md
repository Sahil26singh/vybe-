# Vybe

A full-stack social media application built with React, Node.js, Express, and MongoDB Atlas.

Vybe includes classic social features like creating posts, comments, likes, bookmarks, and real-time direct messaging, alongside AI-assisted features powered by Google Gemini (content moderation, image captioning, and semantic user recommendations via MongoDB Atlas Vector Search).

---

## Features

- **Post Feed**: Create posts with images and captions, with pagination and real-time like/comment updates.
- **AI-Powered Recommendations**: Suggested users are ranked using MongoDB Atlas Vector Search (cosine similarity on 768-dimensional Gemini embeddings built from user bios and recent post captions), with automatic fallback to mutual connections and active user popularity.
- **Direct Messaging**: 1-on-1 real-time chat via Socket.IO with multi-tab synchronization, online status indicators, cursor-based pagination, and support for editing, deleting, and forwarding messages.
- **AI Assist Tools**: Automatic caption generation for images, accessibility alt-text generation, and safety moderation before posts are saved.
- **Notifications**: Instant socket notifications for likes and comments, plus unread message alerts.
- **Bookmarks & Likes**: Dedicated paginated pages for browsing saved and liked posts.
- **Profile Management**: Profile pages with follower/following lists, connection counts, and editable bios and avatars.

---

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Radix UI primitives, Lucide React, Axios, Socket.IO Client
- **Backend**: Node.js, Express 5, MongoDB Atlas (Mongoose 8), Socket.IO
- **AI / Search**: Google Gemini API (`gemini-2.0-flash`, `gemini-embedding-001`), MongoDB Atlas Vector Search
- **Media**: Sharp (server-side image optimization), Cloudinary
- **Authentication**: JWT stored in `httpOnly` secure cookies, bcrypt password hashing

---

## Project Structure

```
vybe/
├── backend/
│   ├── config/              # CORS allowed origins
│   ├── controllers/         # Route logic (user, post, message, notification)
│   ├── middlewares/         # Auth, multer, and validation guards
│   ├── models/              # Mongoose schemas (User, Post, Message, Conversation, etc.)
│   ├── routes/              # Express route declarations
│   ├── services/            # Background embedding queue with rate-limiting
│   ├── socket/              # Socket.IO handlers and online presence tracking
│   └── utils/               # Gemini AI helpers, Cloudinary config, DB connection
│
└── frontend/
    ├── src/
    │   ├── components/      # React components (Feed, ChatPage, PostDetail, etc.)
    │   ├── context/         # AppContext (auth, active chat, socket lifecycle)
    │   ├── hooks/           # Custom data fetching and real-time hooks
    │   └── lib/             # Axios instance and utilities
    └── ...
```

---

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A MongoDB Atlas cluster (M0 free tier works)
- A Cloudinary account for media hosting
- A Google Gemini API key

### 1. Clone the repository

```bash
git clone https://github.com/Sahil26singh/vybe-.git
cd vybe-
```

### 2. Install dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Setup environment variables

Create a `.env` file in the project root:

```env
PORT=8000
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/vybe

# Authentication
SECRET_KEY=your_jwt_secret_key

# Cloudinary
CLOUD_NAME=your_cloudinary_cloud_name
API_KEY=your_cloudinary_api_key
API_SECRET=your_cloudinary_api_secret

# Gemini AI & Vector Search
GEMINI_API_KEY=your_gemini_api_key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
VECTOR_INDEX_NAME=user_embedding_index

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8000
```

> **Note on Vector Search**: To enable Tier A vector recommendations, configure an Atlas Search index named `user_embedding_index` on the `users` collection (`embedding` field, 768 dimensions, cosine similarity). If the index is not configured, the app gracefully falls back to mutual connections and popular accounts.

### 4. Run the application

Start both the backend and frontend in development:

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

The frontend will run at `http://localhost:5173` and the backend server at `http://localhost:8000`.

To build for production:

```bash
npm run build
npm start
```

---

## API Overview

### Authentication & Users
- `POST /api/v1/user/register` — Register a new account
- `POST /api/v1/user/login` — Log in and set httpOnly JWT cookie
- `POST /api/v1/user/logout` — Clear session cookie
- `GET /api/v1/user/suggested` — Suggested users (Vector Search -> Mutuals -> Popular)
- `GET /api/v1/user/profile/:id` — Get user profile by ID
- `POST /api/v1/user/profile/edit` — Edit bio, gender, and avatar
- `POST /api/v1/user/followorunfollow/:id` — Follow or unfollow a user
- `GET /api/v1/user/:id/followers` — List user's followers
- `GET /api/v1/user/:id/following` — List user's following

### Posts
- `GET /api/v1/post/all` — Paginated home feed posts
- `GET /api/v1/post/:id` — Get single post by ID
- `POST /api/v1/post/addpost` — Create new post with image upload
- `POST /api/v1/post/generate-caption` — Generate AI caption from image preview
- `POST /api/v1/post/:id/like` — Like a post
- `POST /api/v1/post/:id/dislike` — Remove like
- `POST /api/v1/post/:id/bookmark` — Bookmark or un-bookmark post
- `GET /api/v1/post/liked` — Paginated list of posts liked by current user
- `GET /api/v1/post/bookmarked` — Paginated list of posts saved by current user
- `DELETE /api/v1/post/delete/:id` — Delete a post (author only)
- `POST /api/v1/post/:id/comment` — Add a comment
- `GET /api/v1/post/:id/comments` — Get comments for a post
- `DELETE /api/v1/post/:postId/comment/:commentId` — Delete a comment

### Direct Messages
- `POST /api/v1/message/send/:id` — Send a direct message
- `GET /api/v1/message/all/:id` — Fetch chat history (supports pagination and `?before=<id>`)
- `PUT /api/v1/message/edit/:id` — Edit a sent message
- `DELETE /api/v1/message/delete/:id` — Delete a sent message
- `POST /api/v1/message/forward/:id` — Forward a message to another user

### Notifications
- `GET /api/v1/notification` — Get user notifications (likes, comments)
- `GET /api/v1/notification/unread-count` — Get count of unread notifications

---

## License

MIT License. Built by [Sahil Singh](https://github.com/Sahil26singh).
