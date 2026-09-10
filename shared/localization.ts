export type Locale = "pt-BR" | "en";
export const DEFAULT_LOCALE: Locale = "pt-BR";
export const portuguese = {
  "Team Feedback": "Feedback da equipe",
  "About Team Feedback": "Sobre o Feedback da equipe",
  "Preparing your workspace…": "Preparando seu espaço…",
  "A healthier feedback rhythm": "Um ritmo mais saudável de feedback",
  "Small signals.": "Pequenos sinais.",
  "Better conversations.": "Conversas melhores.",
  "Private, recurring feedback designed to help teams talk honestly and act thoughtfully.": "Feedback recorrente e confidencial para ajudar a equipe a conversar com sinceridade e agir com cuidado.",
  "Survey responses are anonymous to coordinators and teammates.": "As respostas são anônimas para a coordenação e os colegas de equipe.",
  "Welcome back": "Que bom ter você aqui",
  "Sign in to continue": "Entre para continuar",
  "Work email": "E-mail de trabalho",
  "Password": "Senha",
  "Sign in": "Entrar",
  "Signing in…": "Entrando…",
  "Forgot your password?": "Esqueceu sua senha?",
  "Accounts are invitation-only. Ask an administrator if you need access.": "O acesso é por convite. Fale com a administração se precisar de uma conta.",
  "Account recovery": "Recuperação de conta",
  "Reset your password": "Redefina sua senha",
  "Reset password": "Redefinir senha",
  "Enter your work email. If it belongs to an active account, we’ll send a short-lived reset link.": "Informe seu e-mail de trabalho. Se ele estiver vinculado a uma conta ativa, enviaremos um link temporário para redefinir sua senha.",
  "Check your inbox if the account exists.": "Se a conta existir, você receberá um e-mail. Confira sua caixa de entrada.",
  "Send reset link": "Enviar link de recuperação",
  "Sending…": "Enviando…",
  "Back to sign in": "Voltar para entrar",
  "Password updated": "Senha atualizada",
  "Choose a new password": "Escolha uma nova senha",
  "Your other sessions have been signed out.": "As outras sessões da sua conta foram encerradas.",
  "Return to sign in": "Voltar para entrar",
  "New password": "Nova senha",
  "Confirm password": "Confirme a senha",
  "Use at least 15 characters. Passphrases work well.": "Use pelo menos 15 caracteres. Uma frase pode ser uma boa senha.",
  "Update password": "Atualizar senha",
  "Updating…": "Atualizando…",
  "This reset link is incomplete.": "Este link de recuperação está incompleto.",
  "The passwords do not match.": "As senhas não coincidem.",
  "You’re invited": "Você recebeu um convite",
  "Welcome, {name}": "Boas-vindas, {name}",
  "Checking your invitation": "Verificando seu convite",
  "Create password": "Crie sua senha",
  "Create account": "Criar conta",
  "Creating account…": "Criando conta…",
  "This invitation link is incomplete.": "Este link de convite está incompleto.",
  "This invitation is not available.": "Este convite não está disponível.",
  "Validating the secure link…": "Validando o link seguro…",
  "Unable to sign in.": "Não foi possível entrar.",
  "Unable to request a reset.": "Não foi possível solicitar a recuperação.",
  "Unable to reset your password.": "Não foi possível redefinir sua senha.",
  "Unable to create your account.": "Não foi possível criar sua conta.",
  "Workspace ready": "Seu espaço está pronto",
  "Hello, {name}": "Olá, {name}",
  "Your account is active. Product dashboards will arrive in the next implementation phases.": "Sua conta está ativa. Os painéis estarão disponíveis nas próximas etapas de desenvolvimento.",
  "Your roles": "Seus perfis de acesso",
  "admin": "Administrador",
  "coordinator": "Coordenador",
  "employee": "Colaborador",
  "Sign out": "Sair",
  "Home": "Início",
  "Privacy": "Privacidade",
  "Primary navigation": "Navegação principal",
  "Open menu": "Abrir menu",
  "Close menu": "Fechar menu",
  "Skip to content": "Pular para o conteúdo",
  "Portuguese": "Português",
  "Language: Portuguese": "Idioma: português",
  "Feedback, with care.": "Feedback, com cuidado.",
  "The email or password is incorrect.": "O e-mail ou a senha está incorreto.",
  "Something went wrong. Please try again.": "Algo deu errado. Tente novamente.",
  "Something went wrong.": "Algo deu errado. Tente novamente.",
  "Please sign in.": "Entre na sua conta para continuar.",
  "Too many attempts. Try again later.": "Muitas tentativas. Tente novamente mais tarde.",
  "This invitation is invalid or has expired.": "Este convite é inválido ou expirou.",
  "This invitation is invalid or has already been used.": "Este convite é inválido ou já foi utilizado.",
  "The invitation request is invalid.": "A solicitação de convite é inválida.",
  "Provide an email, name, and roles.": "Informe e-mail, nome e perfis de acesso.",
  "Provide a valid email, name, and role.": "Informe e-mail, nome e perfil de acesso válidos.",
  "If that account exists, a reset email will arrive shortly.": "Se essa conta existir, você receberá um e-mail de recuperação em breve.",
  "The reset request is invalid.": "A solicitação de recuperação é inválida.",
  "This reset link is invalid or has expired.": "Este link de recuperação é inválido ou expirou.",
  "This reset link is invalid or has already been used.": "Este link de recuperação é inválido ou já foi utilizado.",
  "You do not have access to this action.": "Você não tem permissão para realizar esta ação.",
  "User not found.": "Usuário não encontrado.",
  "Route not found.": "Página não encontrada.",
  "Request is too large.": "A solicitação excede o tamanho permitido.",
  "The request body is invalid.": "O conteúdo da solicitação é inválido.",
  "Request origin is not allowed.": "A origem da solicitação não é permitida.",
  "Use at least 15 characters.": "Use pelo menos 15 caracteres.",
  "Use no more than 128 characters.": "Use no máximo 128 caracteres.",
  "Choose a less common password.": "Escolha uma senha menos comum.",
  "Please fill out this field.": "Preencha este campo.",
  "Please enter a valid email address.": "Informe um endereço de e-mail válido.",
  "You’re invited to Team Feedback": "Seu convite para o Feedback da equipe",
  "Reset your Team Feedback password": "Redefina sua senha do Feedback da equipe",
  "Create your account before {date}.": "Crie sua conta até {date}.",
  "This link expires at {date}.": "Este link expira em {date}.",
  "If you did not expect this message, you can ignore it.": "Se você não esperava esta mensagem, pode ignorá-la.",
} satisfies Record<string, string>;

export function normalizeLocale(value: unknown): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}

export function translate(message: string, locale: Locale, values: Record<string, string> = {}): string {
  // Normalize an already-localized API error so switching languages also updates it.
  const source = Object.entries(portuguese).find(([, text]) => text === message)?.[0] ?? message;
  const template = locale === "pt-BR" ? (portuguese[source as keyof typeof portuguese] ?? source) : source;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function requestLocale(request: Request): Locale {
  return normalizeLocale(request.headers.get("X-Feedback-Locale"));
}

export function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    dateStyle: "long", timeStyle: "short", timeZone: "America/Fortaleza",
  }).format(new Date(value));
}
