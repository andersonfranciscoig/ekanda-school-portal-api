export type TokenPayload = {
  sub: string;
  email: string;
  role: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export interface TokenIssuer {
  issue(payload: TokenPayload): Promise<string>;
  issuePair(payload: TokenPayload): Promise<TokenPair>;
  verifyRefresh(token: string): Promise<TokenPayload>;
}
