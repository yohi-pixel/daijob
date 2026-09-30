import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { MobileBottomNav } from './MobileBottomNav';
import { AuthModal } from './AuthModal';

export function AppLayout() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar onAuthClick={() => setAuthOpen(true)} />
      <main className="pb-20 md:pb-10">
        <Outlet />
      </main>
      <MobileBottomNav />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
