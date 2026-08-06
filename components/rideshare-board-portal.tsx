"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { RideshareBoard } from "@/components/rideshare-board";

export function RideshareBoardPortal() {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname !== "/") { setTarget(null); return; }
    const placeBoard = () => {
      const photoHeading = Array.from(document.querySelectorAll("h2")).find(node => node.textContent?.trim() === "Frische Beweise");
      const photoSection = photoHeading?.closest("section");
      if (!photoSection?.parentElement) return false;
      let mount = document.getElementById("rideshare-board-mount");
      if (!mount) {
        mount = document.createElement("div");
        mount.id = "rideshare-board-mount";
        photoSection.parentElement.insertBefore(mount, photoSection);
      }
      setTarget(mount);
      return true;
    };
    if (placeBoard()) return;
    const observer = new MutationObserver(() => { if (placeBoard()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return target ? createPortal(<RideshareBoard/>, target) : null;
}
