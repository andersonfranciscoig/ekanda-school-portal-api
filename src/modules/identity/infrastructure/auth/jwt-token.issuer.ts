import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenIssuer } from '../../application/ports/token-issuer.port';

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(private readonly jwt: JwtService) {}

  issue(payload: {
    sub: string;
    email: string;
    role: string;
  }): Promise<string> {
    return this.jwt.signAsync(payload);
  }
}
