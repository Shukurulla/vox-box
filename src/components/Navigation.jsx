import React from "react";
import { BrainCircuit } from "lucide-react";

const Navigation = () => {
  return (
    <nav className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 p-3 shadow-sm">
      <div className="container mx-auto flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <BrainCircuit className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            Помощник Интервью
          </h1>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
