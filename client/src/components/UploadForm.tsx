import { FC, useState, FormEvent, ChangeEvent } from 'react';
import axios from 'axios';
import { Loader2Icon } from 'lucide-react';

interface UploadFormProps {
  user: {
    token: string;
    id: string;
  };
}

const UploadForm: FC<UploadFormProps> = ({ user }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    const formData = new FormData();
    files.forEach((file) => {
      console.log('Adding file to FormData:', file.name, file.type, file.size);
      formData.append('files', file);
    });

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      console.log('Starting upload...');

      const response = await axios.post('/api/upload', formData, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
            console.log('Upload progress:', percentCompleted + '%');
          }
        },
        timeout: 300000, // 5 minute timeout
      });

      console.log('Upload successful:', response.data);
      setFiles([]);
      setSuccess(true);
      setUploadProgress(0);

      // Clear the file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      console.error('Upload error:', error);
      if (axios.isAxiosError(error)) {
        console.error('Error response:', error.response?.data);

        let errorMessage = 'Upload failed. Please try again.';

        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.code === 'ECONNABORTED') {
          errorMessage = 'Upload timeout. Please try with smaller files.';
        } else if (error.message.includes('Network Error')) {
          errorMessage = 'Network error. Please check your connection.';
        }

        setError(errorMessage);
      } else {
        setError('An unexpected error occurred');
      }
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-8 rounded-lg border border-gray-700 bg-gray-800 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-200">Upload Files</h2>
        <p className="mt-2 text-sm text-gray-400">
          Select image or video files to generate thumbnails
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex w-full items-center justify-center">
          <label
            htmlFor="file-upload"
            className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="mb-3 h-10 w-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                ></path>
              </svg>
              <p className="mb-2 text-sm text-gray-400">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-400">Images or videos (max. 100MB)</p>
            </div>
            <input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,video/*"
            />
          </label>
        </div>

        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium text-gray-300 mb-2">Selected files:</p>
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg bg-gray-700/50 p-3 text-sm border border-gray-600"
              >
                <span className="text-gray-300">
                  {file.name} ({formatFileSize(file.size)})
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="ml-2 text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-900/30 border border-red-700 text-red-300 rounded-lg">
            <p className="text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-900/30 border border-green-700 text-green-300 rounded-lg">
            <p className="text-sm">Files uploaded successfully! Processing...</p>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || files.length === 0}
          className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-lg hover:bg-blue-700 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
              Uploading... {uploadProgress}%
            </>
          ) : (
            'Upload'
          )}
        </button>
      </form>
    </div>
  );
};

export default UploadForm;
