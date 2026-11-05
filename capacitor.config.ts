import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iPhone app. It opens the live site, so every change we ship to the site shows up in the app
 * without a new App Store release. Only native bits (push, icon, permissions) need a new build.
 */
const config: CapacitorConfig = {
  appId: "com.rollshot.app",
  appName: "Rollshot",
  webDir: "app-shell",
  appendUserAgent: "RollshotApp",
  backgroundColor: "#ffffff",
  server: {
    url: "https://roll-shot-app.vercel.app",
    errorPath: "error.html",
    // Sign-in hops through Supabase and Apple; keep those inside the app instead of opening Safari.
    allowNavigation: ["*.supabase.co", "appleid.apple.com"],
  },
  ios: {
    contentInset: "never",
    scheme: "Rollshot",
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: true, backgroundColor: "#ffffff", showSpinner: false },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
