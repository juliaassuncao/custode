import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SiteHeader } from "./components/layout/SiteHeader";
import { HomePage } from "./pages/HomePage";
import { ChapterPage } from "./pages/ChapterPage";
import { ImprensaPage } from "./features/imprensa/pages/ImprensaPage";
import { PublicationPage } from "./features/imprensa/pages/PublicationPage";
import { ProjectPage } from "./pages/ProjectPage";
import { SiteFooter } from "./components/layout/SiteFooter";

const AdminAccessPage = lazy(() => import('./features/community-admin/AdminAccessPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <Analytics />
    </BrowserRouter>
  );
}

function AppContent() {
  const { pathname } = useLocation();
  const isPress = pathname === '/imprensa' || pathname.startsWith('/imprensa/');
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  return (
    <>
      {!isPress && <SiteHeader />}
      <Routes>
        <Route path="/admin/*" element={<Suspense fallback={<main className="state-page" role="status">Carregando acesso administrativo…</main>}><AdminAccessPage /></Suspense>} />
        <Route path="/" element={<HomePage />} />
        <Route path="/o-projeto" element={<ProjectPage />} />
        <Route path="/capitulo/:number" element={<ChapterPage />} />
        <Route path="/imprensa" element={<ImprensaPage />} />
        <Route path="/imprensa/:slug" element={<PublicationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isAdmin && <SiteFooter editorial={isPress} />}
    </>
  );
}
