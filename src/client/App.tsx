import { BrowserRouter, Link, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { CalendarPage } from "./pages/Calendar";
import { DetailsPage } from "./pages/Details";
import { HomePage } from "./pages/Home";
import { PrivacyPage } from "./pages/Privacy";
import { SearchPage } from "./pages/Search";
import { SettingsPage } from "./pages/Settings";
import { TermsPage } from "./pages/Terms";
import { PlaceProvider } from "./place";

function NotFoundPage() {
  return (
    <div className="space-y-4 text-center">
      <h1 className="font-bold text-2xl">ページが見つかりません</h1>
      <Link to="/" className="text-sky-700 underline">
        ホームへ戻る
      </Link>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/details/:date" element={<DetailsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <PlaceProvider>
        <AppRoutes />
      </PlaceProvider>
    </BrowserRouter>
  );
}
