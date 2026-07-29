import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage   from './pages/DashboardPage';
import TOCSubjectPage  from './pages/TOCSubjectPage';
import ComingSoonPage  from './pages/ComingSoonPage';

export default function App() {
  return (
    <Routes>
      <Route path="/"           element={<DashboardPage />} />
      <Route path="/toc/*"      element={<TOCSubjectPage />} />
      <Route path="/nlp"        element={<ComingSoonPage />} />
      <Route path="/ai"         element={<ComingSoonPage />} />
      <Route path="/cn"         element={<ComingSoonPage />} />
      <Route path="/dsa"        element={<ComingSoonPage />} />
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  );
}
