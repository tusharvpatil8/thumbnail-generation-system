"use client"

import { useState } from "react"
import Auth from "./components/Auth"
import UploadForm from "./components/UploadForm"
import JobList from "./components/JobList"

function App() {
  const [user, setUser] = useState(null)

  return (
    // Removed "container mx-auto p-4" to allow Auth.js's full-screen background to show
    <div className="min-h-screen">
      {!user ? (
        <Auth setUser={setUser} />
      ) : (
        // When logged in, apply the consistent dark background
        <div className="min-h-screen bg-gradient-to-br from-gray-950 to-black p-4">
          <UploadForm user={user} />
          <JobList user={user} />
        </div>
      )}
    </div>
  )
}

export default App
