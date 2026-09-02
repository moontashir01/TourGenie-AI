import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  Users,
  MapPinned,
  Building2,
  Bus,
  MessageSquareWarning,
  BarChart3,
  FileBarChart,
  Compass,
  ScrollText,
  CalendarRange,
  Ticket,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Overview from "./admin/Overview";
import UsersTab from "./admin/Users";
import Attractions from "./admin/Attractions";
import Transport from "./admin/Transport";
import Hotels from "./admin/Hotels";
import Reviews from "./admin/Reviews";
import Reports from "./admin/Reports";
import Activity from "./admin/Activity";
import Trips from "./admin/Trips";
import Bookings from "./admin/Bookings";
import GlobalSearch from "../components/admin/GlobalSearch";
import UserDetail from "../components/admin/UserDetail";
import TripDetail from "../components/admin/TripDetail";

const STAFF = ["moderator", "admin", "owner"];
const ADMIN = ["admin", "owner"];

// Each tab names the roles it is for, so a moderator is not shown doors that
// answer 403 when opened.
const tabs = [
  { key: "overview", label: "Overview", icon: BarChart3, component: Overview, roles: STAFF },
  { key: "users", label: "Users", icon: Users, component: UsersTab, roles: STAFF },
  { key: "trips", label: "Trips", icon: CalendarRange, component: Trips, roles: STAFF },
  { key: "bookings", label: "Bookings", icon: Ticket, component: Bookings, roles: STAFF },
  { key: "attractions", label: "Attractions", icon: MapPinned, component: Attractions, roles: ADMIN },
  { key: "hotels", label: "Hotels", icon: Building2, component: Hotels, roles: ADMIN },
  { key: "transport", label: "Transport", icon: Bus, component: Transport, roles: ADMIN },
  { key: "reviews", label: "Reviews", icon: MessageSquareWarning, component: Reviews, roles: STAFF },
  { key: "reports", label: "Reports", icon: FileBarChart, component: Reports, roles: ADMIN },
  { key: "activity", label: "Activity", icon: ScrollText, component: Activity, roles: STAFF },
];

export default function Admin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  // Opened from the search box, from any tab — a lookup shouldn't require
  // navigating to the right list first.
  const [searchedUserId, setSearchedUserId] = useState(null);
  const [searchedTripId, setSearchedTripId] = useState(null);

  if (!STAFF.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const visibleTabs = tabs.filter((t) => t.roles.includes(user.role));
  const current = visibleTabs.find((t) => t.key === activeTab) || visibleTabs[0];
  const ActiveComponent = current.component;
  const activeLabel = current.label;

  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="theme-ink hidden md:flex w-60 shrink-0 flex-col border-r border-sand bg-ink-900 py-6 px-4">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 mb-8">
          <Compass className="w-6 h-6 text-sunset" strokeWidth={1.75} />
          <span className="font-display text-lg text-paper">Admin console</span>
        </Link>
        <p className="px-2 -mt-6 mb-8 text-[11px] uppercase tracking-wide text-paper/40 capitalize">
          Signed in as {user.role}
        </p>
        <nav className="flex flex-col gap-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                activeTab === tab.key ? "bg-ink-800 text-sunset" : "text-paper/60 hover:bg-ink-800 hover:text-paper"
              }`}
            >
              <tab.icon className="w-4 h-4" strokeWidth={1.75} />
              {tab.label}
            </button>
          ))}
        </nav>
        <Link
          to="/dashboard"
          className="mt-auto text-xs text-paper/40 hover:text-paper/70 px-4"
        >
          ← Back to traveler view
        </Link>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="border-b border-sand bg-surface/40 px-6 md:px-10 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
            <h1 className="font-display text-2xl text-ink-900">{activeLabel}</h1>
            <GlobalSearch onPickUser={setSearchedUserId} onPickTrip={setSearchedTripId} />
          </div>
          <p className="text-sm text-ink-900/60 mt-1">
            {activeTab === "overview" && "Platform health at a glance."}
            {activeTab === "users" && "Manage traveler and admin accounts."}
            {activeTab === "attractions" && "Manage the curated attractions database."}
            {activeTab === "hotels" && "Manage the hotel database used for recommendations."}
            {activeTab === "transport" && "Manage bus, train, and launch options."}
            {activeTab === "reviews" && "Moderate community posts and attraction reviews."}
            {activeTab === "reports" && "Platform analytics and exportable reports."}
            {activeTab === "trips" && "Every trip across all travellers, and how each plan was built."}
            {activeTab === "bookings" && "Tickets and reservations, searchable by reference."}
            {activeTab === "activity" && "Every change made from this portal, and who made it."}
          </p>
        </header>

        <main className="px-6 md:px-10 py-8">
          <ActiveComponent />
        </main>

        <UserDetail userId={searchedUserId} onClose={() => setSearchedUserId(null)} />
        <TripDetail tripId={searchedTripId} onClose={() => setSearchedTripId(null)} />
      </div>
    </div>
  );
}
