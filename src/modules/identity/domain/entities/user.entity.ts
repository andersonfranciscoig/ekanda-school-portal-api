import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { InvariantViolationException } from '../../../../shared/domain/exceptions/domain.exception';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { Phone } from '../../../../shared/domain/value-objects/phone.vo';

export enum UserRole {
  GUARDIAN = 'GUARDIAN',
  SCHOOL_OWNER = 'SCHOOL_OWNER',
  SCHOOL_ADMIN = 'SCHOOL_ADMIN',
  EKANDA_ADMIN = 'EKANDA_ADMIN',
}

export class User extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private _firstName: string,
    private _lastName: string,
    private _email: Email,
    private _phone: Phone | null,
    private _passwordHash: string,
    private _role: UserRole,
    private _isActive: boolean,
    private _emailVerified: boolean,
    private _phoneVerified: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(params: {
    id: string;
    firstName: string;
    lastName: string;
    email: Email;
    phone?: Phone | null;
    passwordHash: string;
    role?: UserRole;
  }): User {
    const now = new Date();
    const role = params.role ?? UserRole.GUARDIAN;

    return new User(
      params.id,
      params.firstName.trim(),
      params.lastName.trim(),
      params.email,
      params.phone ?? null,
      params.passwordHash,
      role,
      true,
      false,
      false,
      now,
      now,
    );
  }

  static rehydrate(params: {
    id: string;
    firstName: string;
    lastName: string;
    email: Email;
    phone: Phone | null;
    passwordHash: string;
    role: UserRole;
    isActive: boolean;
    emailVerified: boolean;
    phoneVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return new User(
      params.id,
      params.firstName,
      params.lastName,
      params.email,
      params.phone,
      params.passwordHash,
      params.role,
      params.isActive,
      params.emailVerified,
      params.phoneVerified,
      params.createdAt,
      params.updatedAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  get email(): Email {
    return this._email;
  }

  get phone(): Phone | null {
    return this._phone;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get role(): UserRole {
    return this._role;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get emailVerified(): boolean {
    return this._emailVerified;
  }

  get phoneVerified(): boolean {
    return this._phoneVerified;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  assertCanAuthenticate(): void {
    if (!this._isActive) {
      throw new InvariantViolationException('User inactive');
    }
  }

  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  promoteToSchoolOwner(): void {
    this._role = UserRole.SCHOOL_OWNER;
    this._updatedAt = new Date();
  }

  updateProfile(params: {
    firstName?: string;
    lastName?: string;
    phone?: Phone | null;
  }): void {
    if (params.firstName !== undefined) {
      const value = params.firstName.trim();
      if (value.length < 2) {
        throw new InvariantViolationException('Nome inválido');
      }
      this._firstName = value.slice(0, 80);
    }
    if (params.lastName !== undefined) {
      const value = params.lastName.trim();
      if (value.length < 2) {
        throw new InvariantViolationException('Apelido inválido');
      }
      this._lastName = value.slice(0, 80);
    }
    if (params.phone !== undefined) {
      this._phone = params.phone;
    }
    this._updatedAt = new Date();
  }

  toPublic() {
    return {
      id: this._id,
      firstName: this._firstName,
      lastName: this._lastName,
      email: this._email.value,
      phone: this._phone?.value ?? null,
      role: this._role,
      isActive: this._isActive,
      emailVerified: this._emailVerified,
      phoneVerified: this._phoneVerified,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
