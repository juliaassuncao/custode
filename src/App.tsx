import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader";
import { HomePage } from "./pages/HomePage";
import { ChapterPage } from "./pages/ChapterPage";

export default function App() {
  return (
    <BrowserRouter>
      <SiteHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/capitulo/:number" element={<ChapterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="site-footer">
        Custode · Texto de jmedev · Projeto de{" "}
        <a href="https://x.com/itsxulia">@itsxulia</a>
      </footer>
    </BrowserRouter>
  );
}
