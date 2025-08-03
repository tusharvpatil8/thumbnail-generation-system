const express = require("express")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const User = require("../models/User")
const router = express.Router()

// Add CORS headers to all auth routes as well
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3001")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.header("Access-Control-Allow-Credentials", "true")

  if (req.method === "OPTIONS") {
    return res.sendStatus(200)
  }
  next()
})

router.post("/signup", async (req, res) => {
  try {
    const user = new User(req.body)
    await user.save()
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET)
    res.json({ token })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET)
    res.json({ token })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

module.exports = router
