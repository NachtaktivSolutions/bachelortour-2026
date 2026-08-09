import crypto from "node:crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

const clientId=()=>process.env.SPOTIFY_CLIENT_ID!;
const clientSecret=()=>process.env.SPOTIFY_CLIENT_SECRET!;
export const redirectUri=()=>process.env.SPOTIFY_REDIRECT_URI!;

function key(){return crypto.createHash("sha256").update(clientSecret()).digest()}
export function encrypt(value:string){const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv("aes-256-gcm",key(),iv);const data=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);const tag=cipher.getAuthTag();return Buffer.concat([iv,tag,data]).toString("base64url")}
export function decrypt(value:string){const raw=Buffer.from(value,"base64url");const iv=raw.subarray(0,12),tag=raw.subarray(12,28),data=raw.subarray(28);const decipher=crypto.createDecipheriv("aes-256-gcm",key(),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(data),decipher.final()]).toString("utf8")}

export function userClient(accessToken:string):SupabaseClient{return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:`Bearer ${accessToken}`}},auth:{persistSession:false,autoRefreshToken:false}})}

export async function requireAdmin(accessToken:string){if(!accessToken)throw new Error("UNAUTHORIZED");const sb=userClient(accessToken);const {data:{user},error}=await sb.auth.getUser(accessToken);if(error||!user)throw new Error("UNAUTHORIZED");const {data:profile}=await sb.from("profiles").select("id,is_admin").eq("id",user.id).maybeSingle();if(!profile?.is_admin)throw new Error("FORBIDDEN");return {sb,user}}

export async function refreshSpotifyToken(sb:SupabaseClient){const {data,error}=await sb.from("jukebox_spotify_auth").select("encrypted_refresh_token").eq("id",1).maybeSingle();if(error||!data?.encrypted_refresh_token)throw new Error("SPOTIFY_NOT_CONNECTED");const refreshToken=decrypt(data.encrypted_refresh_token);const body=new URLSearchParams({grant_type:"refresh_token",refresh_token:refreshToken});const res=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body,cache:"no-store"});if(!res.ok)throw new Error("SPOTIFY_REFRESH_FAILED");return await res.json() as {access_token:string;token_type:string;expires_in:number;refresh_token?:string};}

export async function spotifyFetch(sb:SupabaseClient,path:string,init:RequestInit={}){const token=await refreshSpotifyToken(sb);const headers=new Headers(init.headers);headers.set("Authorization",`Bearer ${token.access_token}`);if(init.body&&!headers.has("Content-Type"))headers.set("Content-Type","application/json");return fetch(`https://api.spotify.com/v1${path}`,{...init,headers,cache:"no-store"})}

export function spotifyClientId(){return clientId()}
