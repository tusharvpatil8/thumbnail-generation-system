# Thumbnail Generation System

## Effortlessly create and manage high-quality video and image thumbnails with our powerful platform.

## Demo Video
https://github.com/user-attachments/assets/0ab2732f-3d89-4a3b-bc98-cbf1616797eb

## Setup
1. Install Docker and Docker Compose
2. Run `docker-compose up -d` to start MongoDB and Redis
3. Install FFmpeg on your system
4. Backend:
   - `cd server`
   - `npm install`
   - Create `.env` with:
     ```
     MONGO_URI=mongodb://localhost:27017/thumbnail-system
     JWT_SECRET=your-secret-key
     ```
   - Run `npm start` for the server
   - Run `npm run worker` for the thumbnail worker
5. Frontend:
   - `cd client`
   - `npm install`
   - `npm start`

## Features
- User authentication (signup/login)
- Multi-file upload (images/videos)
- Real-time job status updates
- Thumbnail generation (128x128) for images and videos
- Download/view completed thumbnails
- Error handling and status display

## Tech Stack
- Backend: Node.js, Express, MongoDB, BullMQ, Redis, Sharp, FFmpeg, Socket.io
- Frontend: React, Tailwind CSS, Axios  
