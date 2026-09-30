export type MailContent = {
  subject: string;
  html: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapBody(inner: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #222;">
${inner}
</body>
</html>`;
}

export function buildAdmInviteEmail(acceptUrl: string): MailContent {
  const safeUrl = escapeHtml(acceptUrl);
  return {
    subject: 'Convite — ENEM da Read',
    html: wrapBody(`
<p>Você foi convidado(a) para administrar o ENEM da Read.</p>
<p>Clique no link abaixo para criar sua senha e acessar o painel:</p>
<p><a href="${safeUrl}">Aceitar convite</a></p>
<p>Ou copie e cole no navegador:</p>
<p>${safeUrl}</p>
<p>Se você não esperava este e-mail, pode ignorá-lo.</p>
`),
  };
}

export function buildPasswordResetEmail(resetUrl: string): MailContent {
  const safeUrl = escapeHtml(resetUrl);
  return {
    subject: 'Redefinição de senha — ENEM da Read',
    html: wrapBody(`
<p>Recebemos uma solicitação para redefinir a senha da sua conta de administrador.</p>
<p><a href="${safeUrl}">Redefinir senha</a></p>
<p>Ou copie e cole no navegador:</p>
<p>${safeUrl}</p>
<p>Se você não solicitou isso, ignore este e-mail. O link expira em breve.</p>
`),
  };
}

export function buildExamResultsEmail(examNome: string): MailContent {
  const safeNome = escapeHtml(examNome);
  return {
    subject: `Resultados — ${examNome}`,
    html: wrapBody(`
<p>A prova <strong>${safeNome}</strong> foi encerrada.</p>
<p>Em anexo está a planilha com o ranking dos participantes presentes, na mesma ordem do painel.</p>
<p>ENEM da Read — 8ª Igreja Presbiteriana</p>
`),
  };
}
