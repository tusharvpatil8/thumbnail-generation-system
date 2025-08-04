export interface User {
  _id: string;
  username: string;
  email: string;
}

export interface Job {
  _id: string;
  userId: string;
  originalFile: string;          // Full path to original file
  originalName?: string;         // Original filename from user
  thumbnailFile?: string;        // System filename for thumbnail
  filename?: string;             // Original uploaded filename
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  username: string;
}
