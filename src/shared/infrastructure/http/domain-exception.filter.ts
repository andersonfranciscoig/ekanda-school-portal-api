import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  BusinessRuleViolationException,
  ConflictDomainException,
  DomainException,
  EntityNotFoundException,
  ForbiddenDomainException,
  UnauthorizedDomainException,
} from '../../domain/exceptions/domain.exception';
import { SchoolOnboardingIncompleteException } from '../../../modules/school/domain/exceptions/school.exceptions';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.BAD_REQUEST;
    let error = 'Bad Request';

    if (exception instanceof ConflictDomainException) {
      status = HttpStatus.CONFLICT;
      error = 'Conflict';
    } else if (exception instanceof UnauthorizedDomainException) {
      status = HttpStatus.UNAUTHORIZED;
      error = 'Unauthorized';
    } else if (exception instanceof ForbiddenDomainException) {
      status = HttpStatus.FORBIDDEN;
      error = 'Forbidden';
    } else if (exception instanceof EntityNotFoundException) {
      status = HttpStatus.NOT_FOUND;
      error = 'Not Found';
    } else if (
      exception instanceof BusinessRuleViolationException ||
      exception.name === 'InvariantViolationException'
    ) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      error = 'Unprocessable Entity';
    }

    const body: Record<string, unknown> = {
      statusCode: status,
      error,
      message: exception.message,
    };

    if (exception instanceof SchoolOnboardingIncompleteException) {
      body.incompleteSteps = exception.incompleteSteps;
      if (exception.review) {
        body.data = exception.review;
      }
    }

    response.status(status).json(body);
  }
}
