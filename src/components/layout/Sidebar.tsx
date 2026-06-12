'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const navItems = [
  // SUPER_ADMIN portal
  { href: '/hospitals', label: 'Hospitals', icon: '🏥', roles: ['SUPER_ADMIN'] },
  // Hospital staff
  { href: '/dashboard', label: 'Patient Board', icon: '📋', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'] },
  { href: '/appointments', label: 'New Appointment', icon: '📅', roles: ['ADMIN', 'RECEPTIONIST'] },
  { href: '/patients', label: 'Patients', icon: '👥', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
  { href: '/doctor-queue', label: 'My Queue', icon: '🔢', roles: ['DOCTOR', 'NURSE'] },
  { href: '/billing', label: 'Billing Counter', icon: '💰', roles: ['ADMIN', 'RECEPTIONIST'] },
  { href: '/pharmacy', label: 'Pharmacy', icon: '💊', roles: ['ADMIN', 'PHARMACIST'] },
  { href: '/ipd', label: 'IPD Admissions', icon: '🛏️', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'] },
  { href: '/rooms', label: 'Room Management', icon: '🏨', roles: ['ADMIN'] },
  { href: '/lab', label: 'Laboratory', icon: '🔬', roles: ['ADMIN', 'LAB_TECHNICIAN', 'DOCTOR', 'NURSE'] },
  { href: '/doctors', label: 'Doctors', icon: '🩺', roles: ['ADMIN'] },
  { href: '/departments', label: 'Departments', icon: '🏷️', roles: ['ADMIN'] },
  { href: '/staff', label: 'Staff & Passwords', icon: '👤', roles: ['ADMIN'] },
  { href: '/settings', label: 'Settings', icon: '⚙️', roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST'] },
  { href: '/audit', label: 'Audit Trail', icon: '🔍', roles: ['ADMIN', 'SUPER_ADMIN'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const role = user?.role || '';

  const visibleItems = navItems.filter(item => item.roles.includes('ALL') || item.roles.includes(role));

  return (
    <aside className="w-60 flex-shrink-0 bg-slate-900 flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Clinivio</p>
            <p className="text-slate-400 text-xs">Hospital Management</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.map(item => (
          <Link key={item.href} href={item.href} className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          )}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-slate-400 text-xs">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
