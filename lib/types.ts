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
  created_at: string;
};

export type NewsItem = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  created_at: string;
  author_id: string;
};

export type ChatMessage = {
  id: string;
  body: string;
  image_url: string | null;
  created_at: string;
  sender_id: string;
  profiles?: Pick<Profile, "name" | "avatar_url"> | null;
};

export type Photo = {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  uploader_id: string;
  profiles?: Pick<Profile, "name" | "avatar_url"> | null;
};

export type MapPin = {
  id: string;
  title: string;
  description: string | null;
  latitude: number;
  longitude: number;
  starts_at: string | null;
  created_at: string;
};
