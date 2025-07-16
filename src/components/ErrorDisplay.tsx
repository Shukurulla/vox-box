import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorDisplayProps {
  error: string | null;
  onClose: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <div className="fixed top-4 right-4 left-4 md:left-auto md:max-w-md z-50 bg-red-100 dark:bg-red-900/60 backdrop-blur-sm border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded-lg shadow-lg flex items-start">
      <AlertCircle className="w-5 h-5 flex-shrink-0 mr-3 mt-0.5" />
      <div className="flex-grow">{error}</div>
      <button 
        onClick={onClose} 
        className="ml-3 flex-shrink-0 p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default ErrorDisplay;