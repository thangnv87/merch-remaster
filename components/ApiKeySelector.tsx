
import React from 'react';

interface ApiKeySelectorProps {
  onKeySelected: () => void;
}

const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({ onKeySelected }) => {
  const handleOpenSelectKey = async () => {
    try {
      // Fixed: Safe check for window.aistudio before execution
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        // Per instructions: assume success after triggering the dialog to mitigate race conditions
        onKeySelected();
      }
    } catch (err) {
      console.error("Failed to open API key selector", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-md w-full shadow-2xl">
        <h2 className="text-2xl font-bold mb-4 gradient-text">Pro Feature Access</h2>
        <p className="text-slate-400 mb-6 leading-relaxed">
          To generate high-resolution 4K designs using Gemini 3 Pro, you must select your own API key from a paid Google Cloud Project.
        </p>
        
        <div className="space-y-4">
          <button
            onClick={handleOpenSelectKey}
            className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            <span>Select API Key</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </button>
          
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm text-slate-500 hover:text-blue-400 underline underline-offset-4"
          >
            Learn about API billing and setup
          </a>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySelector;