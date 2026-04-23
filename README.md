# SignSpeak (Vercel-ready SPA)

This is the Vercel-ready single-page version of SignSpeak. It is configured for static Vite deployment on Vercel with SPA routing support and a standard `api/` directory for Vercel Serverless Functions.

## Local

```
npm install
npm run dev
```

## Deploy to Vercel

1. Import this folder or GitHub repo into Vercel.
2. Vercel will use:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
3. SPA routing is handled by [`vercel.json`](/C:/Users/LENOVO/Downloads/signspeak-fixed-netlify-v3/vercel.json).
4. Serverless endpoints belong in [`api/`](/C:/Users/LENOVO/Downloads/signspeak-fixed-netlify-v3/api).

No environment variables required.
