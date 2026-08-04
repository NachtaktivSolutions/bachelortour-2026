export type Profile = {
  id: string;
  name: string;
  phone: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  share_location: boolean;
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
  chat_last_read_at: string | null;
  participant_status: string | null;
  status_updated_at: string | null;
  created_at: string;
};

export type EventSettings = {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  hero_image_url: string | null;
  spotify_url: string | null;
  weather_latitude: number | null;
  weather_longitude: number | null;
  starts_at: string;
  updated_at: string;
};

export type ProgramItem = {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};

export type NewsItem = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  created_at: string;
  author_id: string;
  profiles?: Pick<Profile, "name" | "avatar_url"> | null;
};

export type ChatMessage = {
  id: string;
  body: string;
  image_url: string | null;
  created_at: string;
  sender_id: string;
  profiles?: Pick<Profile, "name" | "avatar_url"> | null;
};

export type PhotoComment = {
  id: string;
  photo_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: Pick<Profile, "name" | "avatar_url"> | null;
};

export type Photo = {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  uploader_id: string;
  profiles?: Pick<Profile, "name" | "avatar_url"> | null;
  photo_likes?: { user_id: string }[];
  photo_comments?: PhotoComment[];
};

export type MapPin = {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};
