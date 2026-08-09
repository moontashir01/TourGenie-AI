import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import PlanTrip from "./pages/PlanTrip";
import Itinerary from "./pages/Itinerary";
import Budget from "./pages/Budget";
import Chat from "./pages/Chat";
import Community from "./pages/Community";
import Documents from "./pages/Documents";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/plan" element={<PlanTrip />} />
        <Route path="/itinerary" element={<Itinerary />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/community" element={<Community />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
