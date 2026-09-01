import React from 'react';
import { Home, Calendar, Clock, UserCheck, Shield, PlusCircle, LayoutDashboard, FileText, CheckSquare, Settings } from 'lucide-react';
import { Screen, User } from '../types';
import { useTranslation } from '../utils/translations';

interface CurvedBottomNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  currentUser: User | null;
  onOpenLeaveModal: () => void;
  lang?: 'en' | 'hi';
}

export const CurvedBottomNav: React.FC<CurvedBottomNavProps> = ({
  currentScreen,
  onNavigate,
  currentUser,
  onOpenLeaveModal,
  lang = 'en'
}) => {
  const t = useTranslation(lang);
  const isAdmin = currentUser?.role === 'super_admin';
  const isDirector = currentUser?.role === 'director';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto pointer-events-none px-3 pb-3 pt-0">
      {/* iOS Floating Island Bar */}
      <nav 
        aria-label="Bottom Navigation" 
        className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 border border-slate-200/80 dark:border-slate-800 px-2 py-1.5 pointer-events-auto flex items-center justify-around"
      >
        
        {/* Regular Staff Navigation */}
        {!isAdmin && !isDirector ? (
          <>
            {/* Home */}
            <button
              id="nav-home-btn"
              onClick={() => onNavigate('home')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
                currentScreen === 'home'
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${currentScreen === 'home' ? 'bg-blue-50 dark:bg-blue-950/60' : ''}`}>
                <Home className={`w-5 h-5 ${currentScreen === 'home' ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('home')}</span>
            </button>

            {/* Timesheet (Renamed from History) */}
            <button
              id="nav-timesheet-btn"
              onClick={() => onNavigate('history')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
                currentScreen === 'history'
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${currentScreen === 'history' ? 'bg-blue-50 dark:bg-blue-950/60' : ''}`}>
                <Clock className={`w-5 h-5 ${currentScreen === 'history' ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('timesheet')}</span>
            </button>

            {/* Apply Leave / Request */}
            <button
              id="nav-apply-leave-btn"
              onClick={onOpenLeaveModal}
              className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all active:scale-95"
            >
              <div className="p-1 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30 hover:bg-blue-700 transition-colors">
                <PlusCircle className="w-5 h-5 stroke-[2.2px]" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('leave')}</span>
            </button>

            {/* Profile */}
            <button
              id="nav-profile-btn"
              onClick={() => onNavigate('profile')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
                currentScreen === 'profile'
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${currentScreen === 'profile' ? 'bg-blue-50 dark:bg-blue-950/60' : ''}`}>
                <UserCheck className={`w-5 h-5 ${currentScreen === 'profile' ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('profile')}</span>
            </button>
          </>
        ) : isDirector ? (
          /* Director Navigation: Dashboard | Attendance | Requests | Profile */
          <>
            <button
              id="nav-director-dash-btn"
              onClick={() => onNavigate('director')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
                currentScreen === 'director'
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${currentScreen === 'director' ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''}`}>
                <LayoutDashboard className={`w-5 h-5 ${currentScreen === 'director' ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('dashboard')}</span>
            </button>

            <button
              id="nav-director-profile-btn"
              onClick={() => onNavigate('profile')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
                currentScreen === 'profile'
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${currentScreen === 'profile' ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''}`}>
                <UserCheck className={`w-5 h-5 ${currentScreen === 'profile' ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('profile')}</span>
            </button>
          </>
        ) : (
          /* Admin Navigation: Admin Console | Profile */
          <>
            <button
              id="nav-admin-console-btn"
              onClick={() => onNavigate('admin')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
                currentScreen === 'admin'
                  ? 'text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${currentScreen === 'admin' ? 'bg-amber-50 dark:bg-amber-950/60' : ''}`}>
                <Shield className={`w-5 h-5 ${currentScreen === 'admin' ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('admin_console')}</span>
            </button>

            <button
              id="nav-admin-profile-btn"
              onClick={() => onNavigate('profile')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
                currentScreen === 'profile'
                  ? 'text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${currentScreen === 'profile' ? 'bg-amber-50 dark:bg-amber-950/60' : ''}`}>
                <UserCheck className={`w-5 h-5 ${currentScreen === 'profile' ? 'stroke-[2.4px]' : 'stroke-[1.8px]'}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('profile')}</span>
            </button>
          </>
        )}

      </nav>
    </div>
  );
};
