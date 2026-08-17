import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_PORT, type MailPort } from './ports/mail.port';
import * as T from '../templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly frontendUrl: string;
  private readonly opsEmail: string;
  private readonly adminBasePath: string;

  constructor(
    @Inject(MAIL_PORT) private readonly mail: MailPort,
    config: ConfigService,
  ) {
    this.frontendUrl = (config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
    this.opsEmail = config.get<string>('EMAIL_OPS') ?? 'ekandacode@gmail.com';
    this.adminBasePath =
      config.get<string>('ADMIN_FRONTEND_PATH') ?? '/portal-ops-7f3a';
  }

  private dispatch(promise: Promise<void>, context: string) {
    void promise.catch((err) =>
      this.logger.error(`Mail failed (${context}): ${err instanceof Error ? err.message : err}`),
    );
  }

  private send(to: { email: string; name?: string }, rendered: T.RenderedEmail, tag: string) {
    return this.mail.send({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [tag],
    });
  }

  // ── Auth ──────────────────────────────────────────────

  sendRegisterOtp(input: { email: string; firstName: string; otp: string }) {
    const rendered = T.authVerifyOtp({
      firstName: input.firstName,
      otp: input.otp,
      expiresMinutes: 10,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.firstName }, rendered, 'auth.verify-otp'),
      'auth.verify-otp',
    );
  }

  sendPasswordReset(input: { email: string; firstName: string; token: string }) {
    const resetUrl = `${this.frontendUrl}/auth/recuperar?token=${encodeURIComponent(input.token)}&email=${encodeURIComponent(input.email)}`;
    const rendered = T.authPasswordReset({
      firstName: input.firstName,
      resetUrl,
      expiresMinutes: 60,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.firstName }, rendered, 'auth.password-reset'),
      'auth.password-reset',
    );
  }

  sendPasswordChanged(input: { email: string; firstName: string }) {
    const rendered = T.authPasswordChanged({ firstName: input.firstName });
    this.dispatch(
      this.send({ email: input.email, name: input.firstName }, rendered, 'auth.password-changed'),
      'auth.password-changed',
    );
  }

  sendWelcomeGuardian(input: { email: string; firstName: string }) {
    const rendered = T.authWelcomeGuardian({
      firstName: input.firstName,
      dashboardUrl: `${this.frontendUrl}/encarregado`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.firstName }, rendered, 'auth.welcome-guardian'),
      'auth.welcome-guardian',
    );
  }

  sendWelcomeSchoolOwner(input: { email: string; firstName: string }) {
    const rendered = T.authWelcomeSchoolOwner({
      firstName: input.firstName,
      onboardingUrl: `${this.frontendUrl}/onboarding`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.firstName }, rendered, 'auth.welcome-school-owner'),
      'auth.welcome-school-owner',
    );
  }

  // ── Beta ──────────────────────────────────────────────

  sendBetaRequestReceived(input: {
    email: string;
    firstName: string;
    testerTypeLabel: string;
  }) {
    const rendered = T.betaRequestReceived(input);
    this.dispatch(
      this.send({ email: input.email, name: input.firstName }, rendered, 'beta.request-received'),
      'beta.request-received',
    );
  }

  sendBetaApproved(input: {
    email: string;
    firstName: string;
    testerTypeLabel: string;
  }) {
    const rendered = T.betaApproved({
      ...input,
      comunidadeUrl: `${this.frontendUrl}/comunidade`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.firstName }, rendered, 'beta.approved'),
      'beta.approved',
    );
  }

  sendBetaRejected(input: {
    email: string;
    firstName: string;
    adminNote?: string | null;
  }) {
    const rendered = T.betaRejected(input);
    this.dispatch(
      this.send({ email: input.email, name: input.firstName }, rendered, 'beta.rejected'),
      'beta.rejected',
    );
  }

  // ── School ────────────────────────────────────────────

  sendSchoolSubmitted(input: {
    email: string;
    ownerName: string;
    schoolName: string;
  }) {
    const rendered = T.schoolSubmittedForReview(input);
    this.dispatch(
      this.send({ email: input.email, name: input.ownerName }, rendered, 'school.submitted'),
      'school.submitted',
    );
  }

  sendSchoolPendingReviewOps(input: {
    schoolName: string;
    ownerEmail: string;
    schoolId: string;
  }) {
    const rendered = T.schoolPendingReviewOps({
      schoolName: input.schoolName,
      ownerEmail: input.ownerEmail,
      adminUrl: `${this.frontendUrl}${this.adminBasePath}/colegios/${input.schoolId}`,
    });
    this.dispatch(
      this.send({ email: this.opsEmail, name: 'Ekanda Ops' }, rendered, 'school.pending-review-ops'),
      'school.pending-review-ops',
    );
  }

  sendSchoolApproved(input: {
    email: string;
    ownerName: string;
    schoolName: string;
    schoolSlug: string;
  }) {
    const rendered = T.schoolApproved({
      ownerName: input.ownerName,
      schoolName: input.schoolName,
      marketplaceUrl: `${this.frontendUrl}/colegio/${input.schoolSlug}`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.ownerName }, rendered, 'school.approved'),
      'school.approved',
    );
  }

  sendSchoolLegalApproved(input: {
    email: string;
    ownerName: string;
    schoolName: string;
  }) {
    const rendered = T.schoolLegalApproved({
      ownerName: input.ownerName,
      schoolName: input.schoolName,
      juridicoUrl: `${this.frontendUrl}/dashboard/juridico`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.ownerName }, rendered, 'school.legal-approved'),
      'school.legal-approved',
    );
  }

  sendSchoolNifDeadlineReminder(input: {
    email: string;
    ownerName: string;
    schoolName: string;
    daysRemaining: number;
    deadlineAt: Date;
  }) {
    const deadlineLabel = input.deadlineAt.toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const rendered = T.schoolNifDeadlineReminder({
      ownerName: input.ownerName,
      schoolName: input.schoolName,
      daysRemaining: input.daysRemaining,
      deadlineLabel,
      juridicoUrl: `${this.frontendUrl}/dashboard/juridico/nif`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.ownerName }, rendered, 'school.nif-deadline'),
      'school.nif-deadline',
    );
  }

  sendSchoolRejected(input: {
    email: string;
    ownerName: string;
    schoolName: string;
    reason: string;
  }) {
    const rendered = T.schoolRejected({
      ...input,
      dashboardUrl: `${this.frontendUrl}/dashboard`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.ownerName }, rendered, 'school.rejected'),
      'school.rejected',
    );
  }

  sendSchoolStatusChanged(input: {
    email: string;
    ownerName: string;
    schoolName: string;
    statusLabel: string;
    reason?: string | null;
  }) {
    const rendered = T.schoolStatusChanged({
      ...input,
      dashboardUrl: `${this.frontendUrl}/dashboard`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.ownerName }, rendered, 'school.status-changed'),
      'school.status-changed',
    );
  }

  // ── Application ───────────────────────────────────────

  sendApplicationSubmittedSchool(input: {
    email: string;
    schoolName: string;
    studentName: string;
    guardianName: string;
    applicationCode: string;
    schoolId: string;
  }) {
    const rendered = T.applicationSubmittedSchool({
      schoolName: input.schoolName,
      studentName: input.studentName,
      guardianName: input.guardianName,
      applicationCode: input.applicationCode,
      dashboardUrl: `${this.frontendUrl}/dashboard/candidaturas`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.schoolName }, rendered, 'application.submitted'),
      'application.submitted',
    );
  }

  sendApplicationAccepted(input: {
    email: string;
    guardianName: string;
    studentName: string;
    schoolName: string;
    applicationCode: string;
  }) {
    const rendered = T.applicationAccepted({
      guardianName: input.guardianName,
      studentName: input.studentName,
      schoolName: input.schoolName,
      trackingUrl: `${this.frontendUrl}/encarregado/candidaturas/${input.applicationCode}`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.guardianName }, rendered, 'application.accepted'),
      'application.accepted',
    );
  }

  sendApplicationRejected(input: {
    email: string;
    guardianName: string;
    studentName: string;
    schoolName: string;
    applicationCode: string;
    reason?: string | null;
  }) {
    const rendered = T.applicationRejected({
      guardianName: input.guardianName,
      studentName: input.studentName,
      schoolName: input.schoolName,
      reason: input.reason,
      trackingUrl: `${this.frontendUrl}/encarregado/candidaturas/${input.applicationCode}`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.guardianName }, rendered, 'application.rejected'),
      'application.rejected',
    );
  }

  sendApplicationDocumentsRequested(input: {
    email: string;
    guardianName: string;
    studentName: string;
    schoolName: string;
    message: string;
    applicationCode: string;
  }) {
    const rendered = T.applicationDocumentsRequested({
      ...input,
      trackingUrl: `${this.frontendUrl}/encarregado/candidaturas/${input.applicationCode}`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.guardianName }, rendered, 'application.documents'),
      'application.documents',
    );
  }

  // ── Gestão ────────────────────────────────────────────

  sendGestaoWaitlistReceived(input: {
    email: string;
    ownerName: string;
    schoolName: string;
  }) {
    const rendered = T.gestaoWaitlistReceived(input);
    this.dispatch(
      this.send({ email: input.email, name: input.ownerName }, rendered, 'gestao.waitlist-received'),
      'gestao.waitlist-received',
    );
  }

  sendGestaoWaitlistApproved(input: {
    email: string;
    ownerName: string;
    schoolName: string;
    testUrl: string | null;
  }) {
    const rendered = T.gestaoWaitlistApproved(input);
    this.dispatch(
      this.send({ email: input.email, name: input.ownerName }, rendered, 'gestao.waitlist-approved'),
      'gestao.waitlist-approved',
    );
  }

  sendGestaoWaitlistRejected(input: {
    email: string;
    ownerName: string;
    schoolName: string;
    adminNote?: string | null;
  }) {
    const rendered = T.gestaoWaitlistRejected(input);
    this.dispatch(
      this.send({ email: input.email, name: input.ownerName }, rendered, 'gestao.waitlist-rejected'),
      'gestao.waitlist-rejected',
    );
  }

  // ── Billing ───────────────────────────────────────────

  sendPaymentConfirmed(input: {
    email: string;
    ownerName: string;
    schoolName: string;
    planName: string;
    amountLabel: string;
  }) {
    const rendered = T.billingPaymentConfirmed({
      ...input,
      dashboardUrl: `${this.frontendUrl}/dashboard/planos`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.ownerName }, rendered, 'billing.payment-confirmed'),
      'billing.payment-confirmed',
    );
  }

  sendSubscriptionExpiring(input: {
    email: string;
    ownerName: string;
    schoolName: string;
    planName: string;
    daysRemaining: number;
  }) {
    const rendered = T.billingSubscriptionExpiring({
      ...input,
      renewUrl: `${this.frontendUrl}/dashboard/planos`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.ownerName }, rendered, 'billing.subscription-expiring'),
      'billing.subscription-expiring',
    );
  }

  sendSubscriptionExpired(input: {
    email: string;
    ownerName: string;
    schoolName: string;
    planName: string;
  }) {
    const rendered = T.billingSubscriptionExpired({
      ...input,
      renewUrl: `${this.frontendUrl}/dashboard/planos`,
    });
    this.dispatch(
      this.send({ email: input.email, name: input.ownerName }, rendered, 'billing.subscription-expired'),
      'billing.subscription-expired',
    );
  }
}
