"use client";

import { init } from "@instantdb/react";
import { hasInstantConfig, publicEnv } from "@/lib/env/public";

let instantClient: ReturnType<typeof init> | null = null;

export function getInstantClient() {
  if (!hasInstantConfig()) {
    return null;
  }

  if (!instantClient) {
    instantClient = init({
      appId: publicEnv.instantAppId,
    });
  }

  return instantClient;
}

export function isInstantConfigured() {
  return hasInstantConfig();
}
