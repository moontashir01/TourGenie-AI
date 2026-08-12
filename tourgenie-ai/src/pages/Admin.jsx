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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Overview from "./admin/Overview";
import UsersTab from "./admin/Users";
import Attractions from "./admin/Attractions";
import Transport from "./admin/Transport";
import Hotels from "./admin/Hotels";
import Reviews from "./admin/Reviews";
import Reports from "./admin/Reports";

const tabs = [
  { key: "overview", label: "Overview", icon: BarChart3, component: Overview },
  { key: "users", label: "Users", icon: Users, component: UsersTab },
  { key: "attractions", label: "Attractions", icon: MapPinned, component: Attractions },
  { key: "hotels", label: "Hotels", icon: Building2, component: Hotels },
  { key: "transport", label: "Transport", icon: Bus, component: Transport },
  { key: "reviews", label: "Reviews", icon: MessageSquareWarning, component: Reviews },
  { key: "reports", label: "Reports", icon: FileBarChart, component: Reports },
];

export default function Admin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const ActiveComponent = tabs.find((t) => t.key === activeTab)?.component || Overview;
  const activeLabel = tabs.find((t) => t.key === activeTab)?.label || "Overview";

  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sand bg-ink-900 py-6 px-4">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 mb-8">
          <Compass className="w-6 h-6 text-sunset" strokeWidth={1.75} />
          <span className="font-display text-lg text-paper">Admin console</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {tabs.map((tab) => (
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
        <header className="border-b border-sand bg-white/40 px-6 md:px-10 py-6">
          <h1 className="font-display text-2xl text-ink-900">{activeLabel}</h1>
          <p className="text-sm text-ink-900/60 mt-1">
            {activeTab === "overview" && "Platform health at a glance."}
            {activeTab === "users" && "Manage traveler and admin accounts."}
            {activeTab === "attractions" && "Manage the curated attractions database."}
            {activeTab === "hotels" && "Manage the hotel database used for recommendations."}
            {activeTab === "transport" && "Manage bus, train, and launch options."}
            {activeTab === "reviews" && "Moderate community posts and attraction reviews."}
            {activeTab === "reports" && "Platform analytics and exportable reports."}
          </p>
        </header>

        <main className="px-6 md:px-10 py-8">
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}
