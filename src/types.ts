export interface Track {
  id: string | number;
  title: string;
  artist: string;
  album?: string;         
  addedAt?: string;       
  duration?: number;      
  size_mb?: number;       
  encoded_audio?: string; 
}

export interface UserProfile {
  username: string;
  displayName: string | null;
  email: string | null;
  bio: string | null;
  avatar: string | null;  
  createdAt?: string | null;
}

export interface ProfileUpdate {
  displayName?: string | null;
  email?: string | null;
  bio?: string | null;
  avatar?: string | null;
}

export interface User {
  username: string;
  displayName?: string | null;
  avatar?: string | null;
}

export interface AuthResponse {
  message: string;
  token: string;
}

export interface RegisterResponse {
  message: string;
  user?: User;
}

export interface MessageResponse {
  message: string;
}

export type ViewName = 'tracks' | 'favorites' | 'profile';

export type RepeatMode = 'off' | 'all' | 'one';

export type ListMode = 'tracks' | 'favorites';
