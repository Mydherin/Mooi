import { env } from '@/config/env';
import { marketingNavLinks } from '@/layouts/marketing/marketingNavLinks';
import { Container } from '@/shared/components/Container';
import { Logo } from '@/shared/components/Logo';

const linkClass =
  'text-sm text-ink-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export const MarketingFooter = () => (
  <footer className="border-t border-line py-12">
    <Container className="grid gap-10 sm:grid-cols-3">
      <div className="flex flex-col gap-3">
        <Logo />
        <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
          Agent sessions on your own repositories, from the first diff to production.
        </p>
        <p className="text-xs text-ink-subtle">
          © {new Date().getFullYear()} {env.appName} · v{env.appVersion}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-[0.18em] text-ink-subtle uppercase">Product</p>
        {marketingNavLinks.map((link) => (
          <a key={link.id} href={link.href} className={linkClass}>
            {link.label}
          </a>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-[0.18em] text-ink-subtle uppercase">
          Resources
        </p>
        <a href={env.docsUrl} target="_blank" rel="noreferrer" className={linkClass}>
          Docs
        </a>
        <a href={env.githubUrl} target="_blank" rel="noreferrer" className={linkClass}>
          Repository
        </a>
        <a href={`mailto:${env.contactEmail}`} className={linkClass}>
          Contact
        </a>
      </div>
    </Container>
  </footer>
);
