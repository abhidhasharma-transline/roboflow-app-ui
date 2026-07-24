# Roboflow Clone — Frontend

React + TypeScript + Tailwind v4 + shadcn/ui (manually wired) + React Router + Zustand + Axios.

## 1. Setup — run these once

```bash
cd frontend
npm install
```

## 2. Run the dev server

```bash
npm run dev
```

Opens at `http://localhost:5173`. Everything runs on **mock data** right now — no backend needed to see and click through every page.

## 3. Build for production

```bash
npm run build   # outputs to dist/
npm run preview # preview the production build locally
```

## 4. Folder structure

```
src/
├── app/routes/          ← (reserved for future route-splitting)
├── components/
│   ├── ui/               ← shadcn components (Button, Dialog, Slider, etc.)
│   ├── layout/            ← Sidebar, Topbar, AppShell
│   └── shared/            ← ImageGrid, ProjectCard, StatusBadge
├── features/
│   ├── auth/              ← LoginPage, RegisterPage
│   ├── workspace/         ← WorkspacePage
│   ├── projects/          ← ProjectsPage
│   ├── upload/            ← UploadPage, VideoExtractor
│   ├── annotate/          ← AnnotatePage (3-column), BatchView, JobPage, AnnotationTool (canvas)
│   ├── dataset/           ← DatasetPage
│   └── versions/          ← VersionsPage
├── lib/
│   ├── api.ts             ← real axios instance (baseURL from .env, auth interceptor)
│   └── mockApi.ts         ← mock data, same shape as real API responses
├── hooks/                 ← useProjects, useImages, useBatches, useJobs
├── stores/                ← authStore, workspaceStore, annotationStore (Zustand)
└── types/                 ← Project, ImageItem, Batch, Annotation, AnnotationJob, User, DatasetVersion
```

## 5. Connecting your real backend

The whole point of the `types/` + `mockApi.ts` + `hooks/` split is that **UI code never has to change** when the backend is ready. Steps:

1. **Confirm the contract.** Look at `src/types/*.ts` — these are the shapes your backend responses must match. If your API differs, either adjust the types here or adjust your backend serializers to match. Do this *before* wiring anything, so both sides agree.

2. **Set the base URL.** Copy `.env.example` → `.env` and point `VITE_API_BASE_URL` at your backend, e.g.:
   ```
   VITE_API_BASE_URL=http://localhost:8000/api
   ```

3. **Swap one hook at a time.** Open a hook, e.g. `src/hooks/useProjects.ts`:
   ```ts
   // Before
   import { mockGetProjects } from "@/lib/mockApi"
   mockGetProjects(workspaceId).then(setProjects)

   // After
   import { api } from "@/lib/api"
   api.get(`/workspaces/${workspaceId}/projects`).then(r => setProjects(r.data))
   ```
   No page or component needs to change — they only ever call the hook.

4. **Auth token.** `lib/api.ts` already reads `auth_token` from `localStorage` and attaches it as a Bearer token on every request, and redirects to `/login` on a 401. `authStore.ts` already writes that token on login. Once your backend's `/auth/login` endpoint is ready, swap `mockLogin` in `LoginPage.tsx` / `RegisterPage.tsx` the same way.

5. **Do this feature-by-feature**, not all at once: Auth → Workspaces → Projects → Images/Batches → Jobs → Annotations → Versions. Each swap is isolated to one hook file, so you can integrate and test incrementally while the rest of the app keeps working on mock data.

## 6. Design notes

- Colors, spacing, and radius are all CSS variables in `src/index.css` (`--brand`, `--sidebar`, etc.) — change them there to re-theme everything at once.
- The sidebar uses a dedicated dark palette (`--sidebar-*`) independent of light/dark mode, matching typical annotation-tool UIs (Roboflow, Labelbox, CVAT all do this).
- Send Roboflow screenshots whenever you get a chance — spacing, exact nav items, and the annotation toolbar can be refined to match closely once you do.
