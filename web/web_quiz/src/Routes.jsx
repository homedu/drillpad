import { Routes, Route } from 'react-router-dom';
import LoginPage from './Login';
import App from './App';

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/qdp" element={<App />} />
            <Route path="*" element={<LoginPage />} />
        </Routes>
    );
}