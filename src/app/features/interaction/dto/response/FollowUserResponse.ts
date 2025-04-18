export interface FollowUserResponse {
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  // Optional fields (add if needed and if backend provides them)
  // farmName?: string | null;
  // followedAt?: string; // ISO date string
}
