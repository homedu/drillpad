import { Routes, Route } from 'react-router-dom';
import LoginPage from './Login.jsx';
import QDP from './App.jsx';
// import AdminPage from './pages/AdminPage.jsx';
// import UserPage from './pages/UserPage.jsx';
// import FeaturePage from './pages/FeaturePage.jsx';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/qdp" element={<QDP />} />
            {/* <Route path="/admin" element={<AdminPage />} />
            <Route path="/user" element={<UserPage />} />
            <Route path="/feature" element={<FeaturePage />} />
            <Route path="/feature/:username" element={<FeaturePage />} /> */}
            <Route path="*" element={<LoginPage />} />
        </Routes>
    );
}