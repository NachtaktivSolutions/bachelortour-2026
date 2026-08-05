"use client";

import { useEffect } from "react";
import { OnboardingTour } from "./onboarding-tour";

const targets: Array<[string, string]> = [
  [".brand-lockup", "brand"],
  [".top-actions a[href='/tour-tools']", "help"],
  [".top-actions a[href='/profile']", "profile"],
  [".bottom-nav a[href='/map']", "map"],
  [".bottom-nav a[href='/chat']", "chat"],
  [".bottom-nav a[href='/gallery']", "gallery"]
];

export function OnboardingExperience() {
  useEffect(() => {
    const connectTargets = () => {
      for (const [selector, name] of targets) {
        document.querySelector(selector)?.setAttribute("data-tour", name);
      }
    };

    connectTargets();
    const observer = new MutationObserver(connectTargets);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <OnboardingTour />;
}
