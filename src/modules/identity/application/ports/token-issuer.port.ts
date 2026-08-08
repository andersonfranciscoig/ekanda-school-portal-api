export interface TokenIssuer {
  issue(payload: {
    sub: string;
    email: string;
    role: string;
  }): Promise<string>;
}
