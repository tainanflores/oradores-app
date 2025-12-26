/* Google Identity Services - minimal typing */

declare global {
  namespace google {
    namespace accounts {
      namespace oauth2 {
        interface TokenResponse {
          access_token?: string;
          expires_in?: number;
          scope?: string;
          token_type?: string;
        }

        interface TokenClient {
          requestAccessToken(options?: { prompt?: string }): void;
          callback: (response: TokenResponse) => void;
        }

        function initTokenClient(options: {
          client_id: string;
          scope: string;
          callback: (response: TokenResponse) => void;
        }): TokenClient;

        function revoke(token: string): void;
      }
    }
  }
}

export {};
