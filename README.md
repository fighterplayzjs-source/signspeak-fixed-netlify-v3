# SignSpeak (Netlify-ready SPA)

This is the Netlify-ready single-page version of SignSpeak. It fixes the black-screen issue caused by the original SSR build not being compatible with Netlify static hosting.

## Local

```
npm install
npm run dev
```

## Deploy to Netlify

1. Push this folder to a GitHub repo (or drag the project folder into Netlify).
2. Netlify auto-detects `netlify.toml`:
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `dist`
3. Deploy. SPA routing is handled by `public/_redirects`.

No environment variables required.
