import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import StudentApp from './pages/StudentApp';
import AdminApp from './pages/AdminApp';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StudentApp />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
