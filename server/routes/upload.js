const express = require("express")
const { Queue } = require("bullmq")
const Job = require("../models/Job")
const jwt = require("jsonwebtoken")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const router = express.Router()
require("dotenv").config({ path: "./.env" }) // Ensure dotenv loads from the correct path

// Ensure uploads directory exists
const uploadsDir = "uploads"
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Middleware to verify JWT token
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/")
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, `${uniqueSuffix}${ext}`)
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10, // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    console.log("Processing file:", file.originalname, "Type:", file.mimetype)

    // Accept images and videos
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true)
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false)
    }
  },
})

// Queue setup with correct Redis connection
let queue
try {
  queue = new Queue("thumbnail-queue", {
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
    },
  })
  console.log("Queue connected successfully to Redis at", process.env.REDIS_HOST || "localhost")
} catch (error) {
  console.error("Queue connection error:", error)
}

// GET /api/upload - Get user's jobs
router.get("/", authenticateToken, async (req, res) => {
  try {
    console.log("Fetching jobs for user:", req.user.userId)
    const jobs = await Job.find({ userId: req.user.userId }).sort({ createdAt: -1 })
    res.json(jobs)
  } catch (error) {
    console.error("Error fetching jobs:", error)
    res.status(500).json({ error: "Failed to fetch jobs" })
  }
})

// POST /api/upload - Upload files
router.post("/", authenticateToken, (req, res) => {
  console.log("Upload request received from user:", req.user.userId)
  console.log("Content-Type:", req.get("Content-Type"))

  upload.array("files", 10)(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err)

      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File too large. Maximum size is 100MB." })
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ error: "Too many files. Maximum is 10 files." })
      }
      if (err.message.includes("Unsupported file type")) {
        return res.status(400).json({ error: err.message })
      }

      return res.status(400).json({ error: err.message || "Upload failed" })
    }

    try {
      console.log("Files processed:", req.files?.length || 0)

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" })
      }

      const jobs = []
      const io = req.app.get("io")

      for (const file of req.files) {
        console.log("Processing file:", {
          originalname: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
        })

        const jobDoc = new Job({
          userId: req.user.userId,
          originalFile: file.path,
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          status: "queued",
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        await jobDoc.save()
        console.log("Job saved:", jobDoc._id)

        // Add to queue if available
        if (queue) {
          try {
            const queueJob = await queue.add(
              "thumbnail",
              {
                jobId: jobDoc._id.toString(),
                filePath: file.path,
                userId: req.user.userId.toString(),
              },
              {
                priority: 1,
                attempts: 3,
                backoff: {
                  type: "exponential",
                  delay: 2000,
                },
              },
            )
            console.log("Job added to queue:", jobDoc._id, "Queue job ID:", queueJob.id)
          } catch (queueError) {
            console.error("Queue error:", queueError)
            // Update job status to failed if queue fails
            jobDoc.status = "failed"
            jobDoc.error = "Failed to add to processing queue"
            await jobDoc.save()
          }
        } else {
          console.warn("Queue not available, job will remain in queued status")
          jobDoc.status = "failed"
          jobDoc.error = "Processing queue unavailable"
          await jobDoc.save()
        }

        // Emit socket event for real-time updates
        if (io) {
          io.to(req.user.userId).emit("jobUpdate", jobDoc)
        }

        jobs.push(jobDoc)
      }

      res.json({
        message: `${jobs.length} file(s) uploaded successfully`,
        jobs: jobs,
      })
    } catch (error) {
      console.error("Upload error:", error)
      res.status(500).json({ error: "Upload failed" })
    }
  })
})

module.exports = router
