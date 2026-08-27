import { FolderGit2, Mail } from 'lucide-react';
import { env } from '@/config/env';
import { Container } from '@/shared/components/Container';
import { Logo } from '@/shared/components/Logo';

export const Footer = () => (
  <footer className="border-t border-slate-200/70 py-10 dark:border-white/10">
    <Container className="flex flex-col items-center justify-between gap-6 sm:flex-row">
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <Logo />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} {env.appName} · v{env.appVersion}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={`mailto:${env.contactEmail}`}
          aria-label="Send an email"
          className="flex size-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Mail className="size-5" />
        </a>
        <a
          href={env.githubUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open repository"
          className="flex size-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <FolderGit2 className="size-5" />
        </a>
      </div>
    </Container>
  </footer>
);
