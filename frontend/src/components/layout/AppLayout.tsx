import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { AuthModal } from './AuthModal';

export function AppLayout() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar onAuthClick={() => setAuthOpen(true)} />
      <div className="flex pt-16">
        <Sidebar onAuthClick={() => setAuthOpen(true)} />
        <main className="flex-1 min-w-0 pb-20 md:pb-8">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
