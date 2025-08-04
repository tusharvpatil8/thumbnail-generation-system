import { FC, useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';
import { Loader2Icon } from 'lucide-react';
import { Job } from '../types';

interface JobListProps {
  user: {
    token: string;
    id: string;
  };
}

const JobList: FC<JobListProps> = ({ user }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Connect to Socket.IO through the proxy
    const socket: Socket = io({
      forceNew: true,
      reconnection: true,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socket.emit('join', user.id);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('jobUpdate', (job: Job) => {
      console.log('Job update received:', job);
      setJobs((prev) => {
        const index = prev.findIndex((j) => j._id === job._id);
        if (index >= 0) {
          // Update existing job
          const updated = [...prev];
          updated[index] = job;
          return updated;
        }
        // Add new job (e.g., when initially queued)
        return [job, ...prev];
      });
    });

    socket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error);
      setError('Failed to connect to server');
    });

    // Fetch initial jobs using relative URL (proxy will handle routing)
    const fetchJobs = async () => {
      try {
        setLoading(true);
        const response = await axios.get<Job[]>('/api/upload', {
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        });
        setJobs(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching jobs:', err);
        setError('Failed to fetch jobs');
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();

    return () => {
      console.log('Cleaning up socket connection');
      socket.disconnect();
    };
  }, [user]);

  const handleDownload = async (filename: string) => {
    if (!filename) {
      console.warn('No filename provided for download.');
      return;
    }

    try {
      console.log(`Attempting to download: /api/download/${filename}`);
      const response = await axios.get(`/api/download/${filename}`, {
        responseType: 'blob', // Important: responseType must be 'blob' for file downloads
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      // Create a URL for the blob and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename); // Set the download filename
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url); // Clean up the URL object
      console.log(`Successfully triggered download for ${filename}`);
    } catch (error) {
      console.error(`Error downloading file ${filename}:`, error);
      if (axios.isAxiosError(error) && error.response) {
        alert(`Failed to download file: ${error.response.data.error || error.message}`);
      } else if (error instanceof Error) {
        alert(`Failed to download file: ${error.message}`);
      } else {
        alert('Failed to download file');
      }
    }
  };

  // Helper function to extract just the filename from a path
  const getFilenameFromPath = (fullPath: string | undefined) => {
    if (!fullPath) return null;
    // Normalize path separators to forward slashes, then get the last segment
    const normalizedPath = fullPath.replace(/\\/g, '/'); // Replace backslashes with forward slashes
    const parts = normalizedPath.split('/');
    return parts[parts.length - 1]; // Get the last part (filename)
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8 text-gray-300">
        <Loader2Icon className="mr-2 h-6 w-6 animate-spin text-blue-400" />
        <div className="text-lg">Loading jobs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/30 border border-red-700 text-red-300 rounded-lg mx-auto max-w-3xl mb-8">
        <p className="font-medium">Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Your Jobs</h2>
      {jobs.length === 0 ? (
        <div className="text-center p-8 text-gray-500">
          <p>No jobs found. Upload some files to get started!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const displayThumbnailFile = getFilenameFromPath(job.thumbnailFile);
            const displayOriginalFilename = job.originalName || getFilenameFromPath(job.originalFile);

            // Log the raw and processed thumbnail file paths for debugging
            console.log(
              `Job ID: ${job._id}, Raw thumbnailFile: "${job.thumbnailFile}", Display thumbnailFile: "${displayThumbnailFile}"`
            );

            return (
              <div
                key={job._id}
                className="p-4 border border-gray-700 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-800 shadow-md"
              >
                <div className="mb-4 md:mb-0 md:w-2/3">
                  <p className="font-medium text-white text-lg">
                    File: {displayOriginalFilename || 'Unknown file'}
                  </p>
                  <p className="mt-2 text-gray-400">
                    Status:{' '}
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        job.status === 'completed'
                          ? 'bg-green-600/30 text-green-300'
                          : job.status === 'processing'
                          ? 'bg-blue-600/30 text-blue-300'
                          : job.status === 'failed'
                          ? 'bg-red-600/30 text-red-300'
                          : 'bg-gray-600/30 text-gray-300'
                      }`}
                    >
                      {job.status}
                    </span>
                  </p>
                  {job.createdAt && (
                    <p className="text-sm text-gray-500 mt-1">Created: {new Date(job.createdAt).toLocaleString()}</p>
                  )}
                </div>

                {job.status === 'completed' && (
                  <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 md:w-1/3 justify-end">
                    {displayThumbnailFile ? (
                      <img
                        src={`/uploads/${displayThumbnailFile}`} // Corrected path for static serving
                        alt="thumbnail"
                        className="w-28 h-28 object-cover rounded-lg border border-gray-700 shadow-sm"
                        onError={(e) => {
                          // Fallback to textual placeholder if image fails to load
                          const imgElement = e.currentTarget as HTMLImageElement;
                          imgElement.style.display = 'none'; // Hide the broken image icon
                          const parent = imgElement.parentElement;
                          if (parent) {
                            const textPlaceholder = document.createElement('div');
                            textPlaceholder.className =
                              'w-28 h-28 flex items-center justify-center bg-gray-700 text-gray-500 text-xs text-center rounded-lg border border-gray-600';
                            textPlaceholder.textContent = 'Thumbnail not available';
                            parent.insertBefore(textPlaceholder, imgElement);
                          }
                        }}
                      />
                    ) : (
                      // Display textual placeholder if thumbnail is not available
                      <div className="w-28 h-28 flex items-center justify-center bg-gray-700 text-gray-500 text-xs text-center rounded-lg border border-gray-600">
                        Thumbnail not available
                      </div>
                    )}
                    <button
                      onClick={() => handleDownload(displayThumbnailFile!)}
                      disabled={!job.thumbnailFile}
                      className={`px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-base font-semibold ${
                        !job.thumbnailFile ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      Download
                    </button>
                  </div>
                )}

                {job.status === 'processing' && (
                  <div className="flex items-center space-x-3 text-blue-400 md:w-1/3 justify-end">
                    <Loader2Icon className="h-7 w-7 animate-spin" />
                    <span className="text-lg font-medium">Processing...</span>
                  </div>
                )}

                {job.status === 'failed' && (
                  <div className="text-red-400 font-medium text-right md:w-1/3 justify-end">
                    <p className="text-lg">❌ Error processing file</p>
                    {job.error && <p className="text-sm mt-1 text-red-500">Details: {job.error}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default JobList;
