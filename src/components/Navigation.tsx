import React from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Database, Settings, BrainCircuit } from "lucide-react";

const Navigation: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItemClass = (path: string) => {
    return `flex items-center px-4 py-2 rounded-lg transition-all ${
      isActive(path)
        ? "bg-indigo-600 text-white shadow-md"
        : "hover:bg-white/30 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
    }`;
  };

  return (
    <nav className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 p-3 shadow-sm">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BrainCircuit className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            Interview Assistant
          </h1>
        </div>

        <ul className="flex space-x-1">
          <li>
            <Link to="/main_window" className={navItemClass("/main_window")}>
              <MessageSquare size={18} className="mr-1.5" />
              <span>Interview</span>
            </Link>
          </li>
          <li>
            <Link to="/knowledge" className={navItemClass("/knowledge")}>
              <Database size={18} className="mr-1.5" />
              <span>Knowledge Base</span>
            </Link>
          </li>
          <li>
            <Link to="/settings" className={navItemClass("/settings")}>
              <Settings size={18} className="mr-1.5" />
              <span>Settings</span>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navigation;
