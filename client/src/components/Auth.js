"use client"

import { useState } from "react"
import axios from "axios"
import { Loader2Icon } from "lucide-react" // For loading spinner

function Auth({ setUser }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const endpoint = isLogin ? "/login" : "/signup"

    try {
      const response = await axios.post(
        `/api/auth${endpoint}`,
        { email, password },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      )

      const { data } = response
      setUser({
        token: data.token,
        id: JSON.parse(atob(data.token.split(".")[1])).userId,
      })
    } catch (error) {
      console.error("Auth error:", error)
      console.error("Error response:", error.response)
      alert(error.response?.data?.error || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 to-black p-4">
      <div className="w-full max-w-5xl rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-2xl md:flex md:space-x-12">
        {/* Left Side: Title and Description */}
        <div className="mb-8 md:mb-0 md:w-1/2 flex flex-col justify-center text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-extrabold text-blue-400 mb-4 leading-tight">
            Thumbnail Generation System
          </h1>
          <p className="text-lg text-gray-400">
            Effortlessly create and manage high-quality video and image thumbnails with our powerful platform.
          </p>
        </div>

        {/* Right Side: Auth Form */}
        <div className="md:w-1/2">
          <div className="mb-6 space-y-2 text-center md:text-left">
            <h2 className="text-2xl font-bold text-white">
              {isLogin ? "Login to your account" : "Create a new account"}
            </h2>
            <p className="text-sm text-gray-400">
              {isLogin ? "Enter your credentials below" : "Fill in your details to get started"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="m@example.com"
                required
                className="h-12 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-base text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-base text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200"
              />
            </div>
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-lg transition-all duration-200 ease-in-out hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
                  Please wait
                </>
              ) : isLogin ? (
                "Login"
              ) : (
                "Sign Up"
              )}
            </button>
          </form>

          <div className="mt-8 flex flex-col items-center md:items-start gap-3">
            <button
              type="button"
              className="text-md font-medium text-blue-400 transition-colors duration-200 hover:text-blue-300 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setIsLogin(!isLogin)}
              disabled={loading}
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Auth
