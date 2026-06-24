// Global type extension for Google Identity Services (GIS) SDK
// Loaded via <script src="https://accounts.google.com/gsi/client">

interface GoogleIdConfig {
  client_id: string;
  callback: (response: { credential: string }) => void;
  ux_mode?: string;
  auto_select?: boolean;
}

interface GoogleButtonOptions {
  theme?: string;
  size?: string;
  width?: number;
  text?: string;
  shape?: string;
  type?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void;
          renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export {};
