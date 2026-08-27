import { Outlet } from 'react-router-dom';
import { Header } from '@/layouts/Header';
import { Footer } from '@/layouts/Footer';

export const RootLayout = () => (
  <div className="flex min-h-dvh flex-col bg-white text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-50">
    <Header />
    <main className="flex-1">
      <Outlet />
    </main>
    <Footer />
  </div>
);
