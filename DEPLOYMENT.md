# Deploying Collaborative Editor

To put your project live, we recommend deploying your **Frontend** and **Backend** as two separate services. 
Since Vercel Serverless Functions do not easily support the long-running WebSockets needed for live collaboration, we host the Next.js app on Vercel and the Node.js backend on a provider like Railway or Render.

## 1. Deploying the Backend (Node.js)

We recommend using **Railway.app** or **Render.com** for the backend.

1. Publish your code to a GitHub repository.
2. Go to [Railway](https://railway.app) or [Render](https://render.com).
3. Create a **New Web Service** and link your GitHub repository.
4. **Important**: Set the Root Directory to `server`.
5. Set the Start Command to `node index.js`.
6. Deploy! Once deployed, copy the public URL (e.g., `https://my-collab-backend.up.railway.app`).
7. **Note on C++ and Python**: By default, standard Node.js Docker images (which Render/Railway use) have Python installed but might not have `g++`. If you want C++ support live, you can configure a custom `Dockerfile` in the `/server` directory that installs `g++`.

## 2. Deploying the Frontend (Next.js)

We recommend using **Vercel** for the frontend.

1. Go to [Vercel](https://vercel.com) and log in.
2. Click **Add New Project** and import your GitHub repository.
3. Keep the "Root Directory" as the main folder (`/`).
4. In the **Environment Variables** section, add the following:
   - `NEXT_PUBLIC_BACKEND_URL` = `https://your-backend-url.com`
   - `NEXT_PUBLIC_SIGNALING_URL` = `wss://your-backend-url.com`
   *(Replace with the actual URL from Step 1 note: use `wss://` for WebSocket)*
5. Click **Deploy**.

## Running Both Locally

To easily develop locally, we have set up `concurrently` (if you wish to install it in the root). Otherwise, open two terminals:

**Terminal 1:**
```bash
npm run dev
```
**Terminal 2:**
```bash
cd server
npm start
```
