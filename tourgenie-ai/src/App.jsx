import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import PlanTrip from "./pages/PlanTrip";
import Itinerary from "./pages/Itinerary";
import AttractionPicker from "./pages/AttractionPicker";
import Destinations from "./pages/Destinations";
import RouteMap from "./pages/RouteMap";
import Booking from "./pages/Booking";
import TripPrint from "./pages/TripPrint";
import Hotels from "./pages/Hotels";
import Budget from "./pages/Budget";
import Chat from "./pages/Chat";
import Community from "./pages/Community";
import Documents from "./pages/Documents";
import Settings from "./pages/Settings";
import ProtectedRoute from "./components/ProtectedRoute";

// The admin console is only ever opened by staff, so it is fetched on demand
// rather than shipped to every traveller who lands on the home page.
const Admin = lazy(() => import("./pages/Admin"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/plan" element={<ProtectedRoute><PlanTrip /></ProtectedRoute>} />
        <Route path="/itinerary" element={<ProtectedRoute><Itinerary /></ProtectedRoute>} />
        <Route path="/attractions" element={<ProtectedRoute><AttractionPicker /></ProtectedRoute>} />
        <Route path="/destinations" element={<ProtectedRoute><Destinations /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute><RouteMap /></ProtectedRoute>} />
        <Route path="/booking" element={<ProtectedRoute><Booking /></ProtectedRoute>} />
        <Route path="/itinerary/print" element={<ProtectedRoute><TripPrint /></ProtectedRoute>} />
        <Route path="/hotels" element={<ProtectedRoute><Hotels /></ProtectedRoute>} />
        <Route path="/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Suspense
                fallback={
                  <div className="min-h-screen flex items-center justify-center bg-paper text-ink-900/50 text-sm">
                    Loading the admin console…
                  </div>
                }
              >
                <Admin />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Community is browsable by anyone; posting/liking requires login (handled in-page) */}
        <Route path="/community" element={<Community />} />
      </Routes>
    </BrowserRouter>
  );
}
