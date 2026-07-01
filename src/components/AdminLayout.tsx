import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  School,
  GraduationCap,
  UserSquare2,
  ShieldAlert,
  FileBarChart2,
  Settings,
  Video,
  Shield
} from 'lucide-react';
import { clearAuthSession } from '../utils/api';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const adminName = localStorage.getItem('user_name') || 'Super Admin';

  const menuItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Institutes', path: '/admin/institutes', icon: School },
    { name: 'Assessments', path: '/admin/assessments', icon: GraduationCap },
    { name: 'Live Proctoring', path: '/admin/proctoring', icon: Video },
    { name: 'Violations', path: '/admin/violations', icon: ShieldAlert },
    { name: 'Reports', path: '/admin/reports', icon: FileBarChart2 },
  ];

  const handleLogout = () => {
    clearAuthSession();
    navigate('/auth');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-dark">
      <header className="sticky top-0 z-30 w-full bg-[#f4efe6]/80 border-b border-[#10222d]/8 text-[#10222d] shadow-sm backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-8">
              <Link to="/admin" className="flex items-center gap-3 group">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffffff] text-white shadow-lg shadow-[#10222d]/15">
                  <img src="/logo.png" alt="Logo" className="h-11 w-11 object-contain"/>
                </div>
                <div>
                  <h2 className="font-bold text-[#10222d] tracking-wide text-sm leading-none">Levroxen LLC</h2>
                  <span className="text-[9px] text-[#8a7863] font-bold uppercase tracking-wider block mt-0.5">Mission Control</span>
                </div>
              </Link>

              <nav className="hidden md:flex items-center gap-1">
                {menuItems.map((item) => {
                  const isActive = currentPath === item.path;

                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={`flex items-center px-3 py-2 rounded-input text-xs font-semibold tracking-wide transition-all duration-200 ${isActive
                          ? 'bg-white text-[#10222d] shadow-sm border border-white/80'
                          : 'text-[#5f6c73] hover:bg-white/70 hover:text-[#10222d] border border-transparent'
                        }`}
                    >
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-3 pl-4 border-l border-[#10222d]/10">
                <div className="w-8 h-8 rounded-full bg-[#10222d] flex items-center justify-center font-bold text-white text-xs shadow-sm select-none">
                  {adminName[0]}
                </div>
                <div className="hidden lg:block text-left">
                  <h4 className="font-semibold text-[#10222d] text-xs truncate max-w-[120px] leading-tight">{adminName}</h4>
                  <span className="text-[10px] text-[#5f6c73] block mt-0.5">Administrator</span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Logout System"
                  className="px-3 py-1.5 text-[#5f6c73] hover:text-rose-600 hover:bg-rose-550/10 rounded-input transition-all duration-200 text-xs font-semibold"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          <div className="md:hidden overflow-x-auto py-2 border-t border-[#10222d]/8 scrollbar-none">
            <nav className="flex space-x-2 w-max px-2">
              {menuItems.map((item) => {
                const isActive = currentPath === item.path;

                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center px-3 py-1.5 rounded-input text-xs font-semibold transition-all duration-200 whitespace-nowrap ${isActive
                        ? 'bg-white text-[#10222d] shadow-sm border border-white/80'
                        : 'text-[#5f6c73] hover:bg-white/70 hover:text-[#10222d] border border-transparent'
                      }`}
                  >
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 p-content max-w-7xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
};
export default AdminLayout;
