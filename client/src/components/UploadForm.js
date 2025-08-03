"use client"

import { useState } from "react"
import axios from "axios"
import { Loader2Icon } from "lucide-react" // For loading spinner

function UploadForm({ user }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files)
    setFiles(selectedFiles)
    setError(null)
    setSuccess(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (files.length === 0) {
      setError("Please select at least one file")
      return
    }

    const formData = new FormData()
    files.forEach((file) => {
      console.log("Adding file to FormData:", file.name, file.type, file.size)
      formData.append("files", file)
    })

    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      console.log("Starting upload...")

      const response = await axios.post("/api/upload", formData, {
        headers: {
          Authorization: `Bearer ${user.token}`,
          // Don't set Content-Type manually for FormData - let browser set it with boundary
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
          console.log("Upload progress:", percentCompleted + "%")
        },
        timeout: 300000, // 5 minute timeout
      })

      console.log("Upload successful:", response.data)
      setFiles([])
      setSuccess(true)
      setUploadProgress(0)

      // Clear the file input
      const fileInput = document.querySelector('input[type="file"]')
      if (fileInput) {
        fileInput.value = ""
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000)
    } catch (error) {
      console.error("Upload error:", error)
      console.error("Error response:", error.response?.data)

      let errorMessage = "Upload failed. Please try again."

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.code === "ECONNABORTED") {
        errorMessage = "Upload timeout. Please try with smaller files."
      } else if (error.message.includes("Network Error")) {
        errorMessage = "Network error. Please check your connection."
      }

      setError(errorMessage)
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="w-full max-w-3xl mx-auto rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-2xl mb-8">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Upload Files for Thumbnail Generation</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="file-upload" className="block text-sm font-medium text-gray-300 mb-2">
            Select Files
          </label>
          <input
            id="file-upload"
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-400
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-lg file:border-0
                       file:text-sm file:font-semibold
                       file:bg-blue-600 file:text-white
                       hover:file:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors duration-200
                       bg-gray-800 rounded-lg border border-gray-700 cursor-pointer
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={uploading}
          />
          <p className="text-xs text-gray-500 mt-2">
            Supported formats: Images (JPG, PNG, GIF, etc.) and Videos (MP4, AVI, MOV, etc.)
            <br />
            Maximum file size: 100MB per file, Maximum 10 files at once
          </p>
        </div>

        {/* File Preview */}
        {files.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-300">Selected Files ({files.length}):</h3>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatFileSize(file.size)} • {file.type || "Unknown type"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="ml-4 text-red-400 hover:text-red-300 text-sm font-medium transition-colors duration-200"
                    disabled={uploading}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-300">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-700 text-red-300 rounded-lg">
            <p className="font-medium">Upload Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-900/30 border border-green-700 text-green-300 rounded-lg">
            Files uploaded successfully! Processing will begin shortly.
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || files.length === 0}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-lg transition-all duration-200 ease-in-out hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
              {`Uploading... ${uploadProgress}%`}
            </>
          ) : (
            `Upload ${files.length} File${files.length !== 1 ? "s" : ""}`
          )}
        </button>
      </form>
    </div>
  )
}

export default UploadForm
