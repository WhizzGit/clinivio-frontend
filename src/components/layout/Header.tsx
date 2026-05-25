'use client';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

export function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-sm">Welcome,</span>
        <span className="text-gray-900 font-medium text-sm">
          {user?.firstName} {user?.lastName}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {user?.role}
        </span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
