const express = require("express")
const mongoose = require("mongoose")
const { Server } = require("socket.io")
const { QueueEvents, Queue } = require("bullmq") // Import Queue and QueueEvents
const http = require("http")
const authRoutes = require("./routes/auth")
const uploadRoutes = require("./routes/upload")
const socketSetup = require("./sockets/socket")
const cors = require("cors")
const path = require("path")
const fs = require("fs")
const jwt = require("jsonwebtoken")
require("dotenv").config({ path: "./.env" }) // Ensure dotenv loads from the correct path

// Import the Job model to fetch updated job data
const Job = require("./models/Job")

const app = express()
const server = http.createServer(app)

// Simplified CORS configuration for development
const corsOptions = {
  origin: ["http://localhost:3001", "http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions))

// Handle preflight requests
app.options("*", cors(corsOptions))

// Body parsing middleware - but NOT for multipart/form-data
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Static files
app.use("/uploads", express.static("uploads"))

// Add request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    origin: req.get("Origin"),
    contentType: req.get("Content-Type"),
  })
  next()
})

// Middleware for token authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || ""
  const token = authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: missing token" })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
    next()
  } catch (e) {
    console.error("Token verification error:", e)
    return res.status(401).json({ error: "Unauthorized: invalid token" })
  }
}

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/upload", uploadRoutes)

// New download route
app.get("/api/download/:filename", authenticateToken, async (req, res) => {
  try {
    const filename = req.params.filename
    const filePath = path.join(__dirname, "uploads", filename)

    // Basic check to ensure the file exists and is within the uploads directory
    if (!fs.existsSync(filePath) || !filePath.startsWith(path.join(__dirname, "uploads"))) {
      console.warn(`Attempted download of non-existent or out-of-bounds file: ${filePath}`)
      return res.status(404).json({ error: "File not found." })
    }

    console.log(`Attempting to download file: ${filePath}`)
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error(`Error downloading file ${filename}:`, err)
        if (!res.headersSent) {
          res.status(500).json({ error: "Could not download the file." })
        }
      } else {
        console.log(`File ${filename} downloaded successfully.`)
      }
    })
  } catch (error) {
    console.error("Error in download route:", error)
    if (!res.headersSent) {
      res.status(500).json({ error: "Server error during download." })
    }
  }
})

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3001", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Make io available to routes
app.set("io", io)

// MongoDB connection for the main app
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Main App: MongoDB connected successfully"))
  .catch((err) => console.error("Main App: MongoDB connection error:", err))

// Socket.io setup
socketSetup(io)

// BullMQ QueueEvents listener for real-time updates
// Ensure this connects to localhost, not 'redis'
const queueEvents = new QueueEvents("thumbnail-queue", {
  connection: {
    host: process.env.REDIS_HOST || "localhost", // Use environment variable or default to localhost
    port: process.env.REDIS_PORT || 6379, // Use environment variable or default to 6379
  },
})

// Create a Queue instance to fetch job data
const thumbnailQueue = new Queue("thumbnail-queue", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
  },
})

const emitJobUpdate = async (bullMqJobId) => {
  try {
    const bullMqJob = await thumbnailQueue.getJob(bullMqJobId)
    if (bullMqJob && bullMqJob.data && bullMqJob.data.jobId) {
      const mongoJobId = bullMqJob.data.jobId // This is the MongoDB _id
      const job = await Job.findById(mongoJobId)
      if (job) {
        console.log(
          `QueueEvents: Emitting jobUpdate for user ${job.userId} (MongoDB ID: ${job._id}) - Status: ${job.status}`,
        )
        io.to(job.userId.toString()).emit("jobUpdate", job)
      } else {
        console.warn(`QueueEvents: MongoDB Job ${mongoJobId} not found for BullMQ Job ${bullMqJobId}`)
      }
    } else {
      console.warn(`QueueEvents: BullMQ Job ${bullMqJobId} data or MongoDB ID not found.`)
    }
  } catch (error) {
    console.error(`QueueEvents: Error fetching or emitting job update for BullMQ Job ${bullMqJobId}:`, error)
  }
}

queueEvents.on("completed", ({ jobId }) => {
  console.log(`QueueEvents: BullMQ Job ${jobId} completed.`)
  emitJobUpdate(jobId)
})

queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.log(`QueueEvents: BullMQ Job ${jobId} failed: ${failedReason}`)
  emitJobUpdate(jobId)
})

queueEvents.on("active", ({ jobId }) => {
  console.log(`QueueEvents: BullMQ Job ${jobId} is active (processing).`)
  emitJobUpdate(jobId)
})

queueEvents.on("error", (err) => {
  console.error("QueueEvents error:", err)
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err)
  res.status(500).json({ error: "Internal server error" })
})

server.listen(3000, () => console.log("Server running on port 3000"))
