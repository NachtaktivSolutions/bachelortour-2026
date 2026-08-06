import React from "react";
import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET() {
  let artwork = new URL("/brand/logo.jpeg", process.env.NEXT_PUBLIC_SITE_URL || "https://bachelortour-2026.vercel.app").toString();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase
      .from("event_settings")
      .select("hero_image_url")
      .eq("id", 1)
      .maybeSingle();

    if (data?.hero_image_url) artwork = data.hero_image_url;
  } catch {}

  const image = React.createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        backgroundColor: "#050505",
        overflow: "hidden",
        padding: 34
      }
    },
    React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        background: "radial-gradient(circle at 50% 52%, rgba(255,116,0,.22), transparent 58%)"
      }
    }),
    React.createElement("img", {
      src: artwork,
      alt: "",
      width: 512,
      height: 512,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "contain",
        objectPosition: "center",
        borderRadius: 76
      }
    })
  );

  return new ImageResponse(image, {
    width: 512,
    height: 512,
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=60"
    }
  });
}
