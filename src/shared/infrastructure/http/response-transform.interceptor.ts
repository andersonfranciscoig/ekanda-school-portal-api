import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiSuccessResponse, ok } from '../../application/api-response';


@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<unknown>> {
    return next.handle().pipe(
      map((body) => {
        if (
          body &&
          typeof body === 'object' &&
          'data' in body &&
          'message' in body
        ) {
          return body as ApiSuccessResponse<unknown>;
        }
        return ok(body);
      }),
    );
  }
}
