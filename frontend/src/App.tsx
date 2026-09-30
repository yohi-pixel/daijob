import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { JobsPage } from './pages/JobsPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { SavedPage } from './pages/SavedPage';
import { ExplorePage } from './pages/ExplorePage';
import { ResumePage } from './pages/ResumePage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/jobs" replace /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'jobs/:id', element: <JobDetailPage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'saved', element: <SavedPage /> },
      { path: 'resume', element: <ResumePage /> },
      // 旧地址保留，避免已分享的链接失效
      { path: 'map', element: <Navigate to="/explore" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
