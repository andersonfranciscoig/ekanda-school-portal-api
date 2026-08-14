import {
  e,
  highlightBox,
  mailButton,
  mailLayout,
  paragraph,
  type RenderedEmail,
} from './layout';

export function applicationSubmittedSchool(props: {
  schoolName: string;
  studentName: string;
  guardianName: string;
  applicationCode: string;
  dashboardUrl: string;
}): RenderedEmail {
  const subject = `Nova candidatura — ${props.studentName}`;
  const text = `Nova candidatura em ${props.schoolName}.\nAluno: ${props.studentName}\nCódigo: ${props.applicationCode}`;
  const html = mailLayout({
    preview: `Nova candidatura: ${props.studentName}`,
    title: 'Nova candidatura',
    bodyHtml: `
      ${paragraph('Recebeu uma nova candidatura em <strong>' + e(props.schoolName) + '</strong>.')}
      ${highlightBox(`
        <strong>Aluno:</strong> ${e(props.studentName)}<br/>
        <strong>Encarregado:</strong> ${e(props.guardianName)}<br/>
        <strong>Código:</strong> ${e(props.applicationCode)}
      `)}
      ${mailButton(props.dashboardUrl, 'Ver candidaturas')}
    `,
  });
  return { subject, html, text };
}

export function applicationAccepted(props: {
  guardianName: string;
  studentName: string;
  schoolName: string;
  trackingUrl: string;
}): RenderedEmail {
  const subject = 'Candidatura aceite';
  const text = `Olá ${props.guardianName},\n\nCandidatura de ${props.studentName} em ${props.schoolName} foi aceite.\n— Ekanda`;
  const html = mailLayout({
    preview: 'A candidatura foi aceite',
    title: 'Candidatura aceite',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.guardianName)}</strong>,`)}
      ${paragraph('A candidatura de <strong>' + e(props.studentName) + '</strong> em <strong>' + e(props.schoolName) + '</strong> foi <strong>aceite</strong>.')}
      ${mailButton(props.trackingUrl, 'Acompanhar candidatura')}
    `,
  });
  return { subject, html, text };
}

export function applicationRejected(props: {
  guardianName: string;
  studentName: string;
  schoolName: string;
  reason?: string | null;
  trackingUrl: string;
}): RenderedEmail {
  const subject = 'Actualização sobre a candidatura';
  const text = `Olá ${props.guardianName},\n\nCandidatura em ${props.schoolName} não foi aceite.\n— Ekanda`;
  const html = mailLayout({
    preview: 'Actualização sobre candidatura',
    title: 'Candidatura não aceite',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.guardianName)}</strong>,`)}
      ${paragraph('A candidatura de <strong>' + e(props.studentName) + '</strong> em <strong>' + e(props.schoolName) + '</strong> não foi aceite neste momento.')}
      ${props.reason ? highlightBox(e(props.reason)) : ''}
      ${mailButton(props.trackingUrl, 'Ver detalhes')}
    `,
  });
  return { subject, html, text };
}

export function applicationDocumentsRequested(props: {
  guardianName: string;
  studentName: string;
  schoolName: string;
  message: string;
  trackingUrl: string;
}): RenderedEmail {
  const subject = 'Documentos em falta na candidatura';
  const text = `Olá ${props.guardianName},\n\nDocumentos em falta — ${props.schoolName}\n${props.message}\n— Ekanda`;
  const html = mailLayout({
    preview: 'Documentos em falta',
    title: 'Documentos necessários',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.guardianName)}</strong>,`)}
      ${paragraph('<strong>' + e(props.schoolName) + '</strong> solicitou documentos ou informação adicional para a candidatura de <strong>' + e(props.studentName) + '</strong>.')}
      ${highlightBox(e(props.message))}
      ${mailButton(props.trackingUrl, 'Ver candidatura')}
    `,
  });
  return { subject, html, text };
}
