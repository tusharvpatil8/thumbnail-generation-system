const { Worker } = require("bullmq")
const sharp = require("sharp")
const ffmpeg = require("ffmpeg-static")
const { execSync, spawnSync } = require("child_process") // Import spawnSync
const path = require("path")
const fs = require("fs")
const mongoose = require("mongoose")
require("dotenv").config({ path: "./.env" })

// Import the Job model
const Job = require("../models/Job")

console.log("Starting thumbnail worker...")

// Connect to MongoDB (worker needs its own connection)
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Worker: MongoDB connected successfully")
  })
  .catch((err) => {
    console.error("Worker: MongoDB connection error:", err)
    process.exit(1) // Exit if MongoDB connection fails
  })

console.log("Redis connection:", {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
})

const worker = new Worker(
  "thumbnail-queue",
  async (job) => {
    const { jobId, filePath, userId } = job.data
    console.log(`Processing job ${jobId} for user ${userId}`)

    try {
      // Update status to processing
      const updatedJob = await Job.findByIdAndUpdate(
        jobId,
        {
          status: "processing",
          updatedAt: new Date(),
        },
        { new: true },
      )

      if (!updatedJob) {
        throw new Error(`Job ${jobId} not found in database`)
      }

      console.log(`Job ${jobId} status updated to processing`)

      // Normalize filePath to use forward slashes for FFmpeg commands
      const normalizedFilePath = filePath.replace(/\\/g, "/")
      console.log(`Normalized input file path for FFmpeg: ${normalizedFilePath}`)

      // Generate thumbnail filename
      const timestamp = Date.now()
      const ext = ".jpg"
      const thumbnailFilename = `thumb-${timestamp}${ext}` // Store only the filename
      let fullThumbnailPath = path.join("uploads", thumbnailFilename) // Full path for file system operations

      // Normalize fullThumbnailPath to use forward slashes for FFmpeg commands
      fullThumbnailPath = fullThumbnailPath.replace(/\\/g, "/")
      console.log(`Normalized output thumbnail path for FFmpeg: ${fullThumbnailPath}`)

      console.log(`Processing file: ${normalizedFilePath}`)
      console.log(`Output thumbnail: ${fullThumbnailPath}`)

      // Check if input file exists
      if (!fs.existsSync(filePath)) {
        // Use original filePath for fs.existsSync
        throw new Error(`Input file not found: ${filePath}`)
      }

      // Determine file type and process accordingly
      const fileExtension = path.extname(filePath).toLowerCase()
      const isVideo = [".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(fileExtension)

      if (isVideo) {
        console.log("Processing video file...")

        try {
          // Get video duration using execSync (capturing output is fine here)
          const durationCmd = `"${ffmpeg}" -i "${normalizedFilePath}" -f null - 2>&1`
          console.log(`Executing FFmpeg duration command: ${durationCmd}`)
          const durationOutput = execSync(durationCmd, { encoding: "utf8" })
          console.log("FFmpeg duration output:", durationOutput)

          // Parse duration from FFmpeg output
          const durationMatch = durationOutput.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/)
          if (!durationMatch) {
            throw new Error(`Could not determine video duration. FFmpeg output: ${durationOutput}`)
          }

          const hours = Number.parseInt(durationMatch[1])
          const minutes = Number.parseInt(durationMatch[2])
          const seconds = Number.parseFloat(durationMatch[3])
          const totalSeconds = hours * 3600 + minutes * 60 + seconds
          const midpointTime = totalSeconds / 2

          console.log(`Video duration: ${totalSeconds}s, extracting frame at: ${midpointTime}s`)

          // --- Use spawnSync for the extraction command ---
          const ffmpegArgs = [
            "-i",
            normalizedFilePath,
            "-ss",
            String(midpointTime), // Ensure time is string
            "-vframes",
            "1",
            "-q:v",
            "2",
            "-y",
            fullThumbnailPath, // This is the output file
          ]

          console.log(`Executing FFmpeg extract with spawnSync. Args:`, ffmpegArgs)

          const spawnResult = spawnSync(ffmpeg, ffmpegArgs, { encoding: "utf8" })

          if (spawnResult.error) {
            throw new Error(`FFmpeg spawn error: ${spawnResult.error.message}`)
          }
          if (spawnResult.status !== 0) {
            console.error("FFmpeg stdout:", spawnResult.stdout)
            console.error("FFmpeg stderr:", spawnResult.stderr)
            throw new Error(`FFmpeg command failed with exit code ${spawnResult.status}`)
          }

          console.log("Frame extracted successfully")

          // Resize the extracted frame to 128x128 using Sharp
          await sharp(fullThumbnailPath)
            .resize(128, 128, { fit: "cover" })
            .jpeg({ quality: 80 })
            .toFile(fullThumbnailPath + ".temp")

          // Replace original with resized version
          fs.renameSync(fullThumbnailPath + ".temp", fullThumbnailPath)
        } catch (ffmpegError) {
          console.error("FFmpeg command execution failed.")
          // Check if it's a spawnResult error or a general Error
          if (ffmpegError.stdout) console.error("FFmpeg stdout:", ffmpegError.stdout.toString())
          if (ffmpegError.stderr) console.error("FFmpeg stderr:", ffmpegError.stderr.toString())
          console.error("Full FFmpeg error object:", ffmpegError)
          throw new Error(`Video processing failed: ${ffmpegError.message}`)
        }
      } else {
        console.log("Processing image file...")

        // Process image with Sharp
        await sharp(filePath).resize(128, 128, { fit: "cover" }).jpeg({ quality: 80 }).toFile(fullThumbnailPath)

        console.log("Image processed successfully")
      }

      // Verify thumbnail was created
      if (!fs.existsSync(fullThumbnailPath)) {
        throw new Error("Thumbnail file was not created")
      }

      const thumbnailStats = fs.statSync(fullThumbnailPath)
      console.log(`Thumbnail created: ${fullThumbnailPath} (${thumbnailStats.size} bytes)`)

      // Update job status to completed, storing only the filename
      const completedJob = await Job.findByIdAndUpdate(
        jobId,
        {
          status: "completed",
          thumbnailFile: thumbnailFilename, // Store only the filename here
          updatedAt: new Date(),
        },
        { new: true },
      )

      console.log(`Job ${jobId} completed successfully`)
      return completedJob // Return the updated job for BullMQ events
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error.message)

      // Update job status to failed
      await Job.findByIdAndUpdate(jobId, {
        status: "failed",
        error: error.message,
        updatedAt: new Date(),
      })

      throw error
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
    },
    concurrency: 1, // Process one job at a time per worker
  },
)

worker.on("completed", async (job) => {
  console.log(`✅ Worker: Job ${job.id} completed successfully`)
})

worker.on("failed", async (job, err) => {
  console.log(`❌ Worker: Job ${job.id} failed: ${err.message}`)
})

worker.on("error", (err) => {
  console.error("Worker error:", err)
})

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down worker...")
  await worker.close()
  await mongoose.connection.close()
  process.exit(0)
})

console.log("Thumbnail worker is running and waiting for jobs...")
