# Life@USTC UI audit evidence — 2026-08-24

- App commit: `f5d2d074407d5fc5386c165fa2b9cc849f456baf`
- Browser: isolated headless Chrome, driven through Chrome DevTools
- Server: local production build via Wrangler; isolated seeded PostgreSQL database
- Viewports: 390×844 mobile, 390×600 reduced-height mobile, 900×800 tablet, and desktop
- The seeded Todo deleted during destructive-action verification was restored immediately.
- Temporary OAuth credentials were deleted and their screenshot is intentionally excluded.