/** Phone alerts need these three settings in Vercel. Without them the bell still works in the app. */
export const pushReady = () =>
  !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.PUSH_SECRET);
