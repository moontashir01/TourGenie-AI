import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import PlanTrip from "./pages/PlanTrip";
import Itinerary from "./pages/Itinerary";
import Hotels from "./pages/Hotels";
import Budget from "./pages/Budget";
import Chat from "./pages/Chat";
import Community from "./pages/Community";
import Documents from "./pages/Documents";
import Admin from "./pages/Admin";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/plan" element={<ProtectedRoute><PlanTrip /></ProtectedRoute>} />
        <Route path="/itinerary" element={<ProtectedRoute><Itinerary /></ProtectedRoute>} />
        <Route path="/hotels" element={<ProtectedRoute><Hotels /></ProtectedRoute>} />
        <Route path="/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

        {/* Community is browsable by anyone; posting/liking requires login (handled in-page) */}
        <Route path="/community" element={<Community />} />
      </Routes>
    </BrowserRouter>
  );
}
