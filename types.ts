
export type ItemStatus = 'idle' | 'processing' | 'done' | 'error';

export interface HistoryItem {
  id: string;
  source: string;
  result: string;
  timestamp: number;
}

export interface RedesignState {
  sourceImage: string | null;
  resultImage: string | null;
  status: ItemStatus;
  error: string | null;
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
    gapi: any;
    google: any;
  }
}
