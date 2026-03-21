export interface Member {
  id: string;
  name: string;
  joinDate: string;
  birthday?: string; // ISO date string
  likes?: string;
  likedFood?: string;
  address?: string;
  phone?: string;
  isGpsMember?: boolean;
  gpsName?: string;
  occupation?: 'none' | 'studying' | 'working' | 'both';
  occupationTime?: 'morning' | 'night' | 'both' | 'none';
  isEvangelized?: boolean;
  isArchived?: boolean;
}

export interface AttendanceRecord {
  date: string; // ISO date string (YYYY-MM-DD)
  presentMemberIds: string[];
}

export type ViewMode = 'attendance' | 'members' | 'community' | 'settings' | 'history';
