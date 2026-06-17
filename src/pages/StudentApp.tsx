import React, { useState, useEffect } from 'react';
import { db } from '../firebaseClient';
import { supabase } from '../supabaseClient';
import { ref, onValue } from 'firebase/database';
import { AppMaterial } from '../types';
import { Tv, FilePenLine, Book, Target, Crosshair, FileJson, Network, CalendarDays, Home, User, LogOut, FileText } from 'lucide-react';

export default function StudentApp() {
  const [allMaterials, setAllMaterials] = useState<AppMaterial[]>([]);
  const [currentTab, setCurrentTab] = useState('home');
  const [currentCategory, setCurrentCategory] = useState('notes');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>('');

  const [savedItems, setSavedItems] = useState<string[]>(JSON.parse(localStorage.getItem('mhtCetSavedItems') || '[]'));
  const [completedItems, setCompletedItems] = useState<string[]>(JSON.parse(localStorage.getItem('mhtCetCompletedItems') || '[]'));

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [zoomItem, setZoomItem] = useState<AppMaterial | null>(null);

  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Auth States
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [onboardForm, setOnboardForm] = useState({
    name: '', std: '', class_name: '', prep: '', phone: '', parent_phone: ''
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkProfile(session.user.id, session.user.user_metadata?.full_name);
      else setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkProfile(session.user.id, session.user.user_metadata?.full_name);
      else {
        setProfile(null);
        setLoadingAuth(false);
      }
    });

    const materialsRef = ref(db, 'study_text_entries');
    const unsubscribe = onValue(materialsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const items = Object.keys(data).map(key => ({ id: key, ...data[key] })) as AppMaterial[];
      items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setAllMaterials(items);
    });

    setSelectedCalendarDate(getLocalYMD(new Date()));

    return () => {
       unsubscribe();
       subscription.unsubscribe();
    };
  }, []);

  const checkProfile = async (userId: string, defaultName?: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error || !data) {
       setOnboardForm(prev => ({ ...prev, name: defaultName || '' }));
       setIsOnboarding(true);
    } else {
       setProfile(data);
       setIsOnboarding(false);
    }
    setLoadingAuth(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) showToast("Login failed: " + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const payload = {
      id: session.user.id,
      email: session.user.email,
      ...onboardForm
    };
    const { error } = await supabase.from('profiles').upsert(payload);
    if (error) {
      showToast("Error saving profile");
    } else {
      showToast("Profile saved!");
      setProfile(payload);
      setIsOnboarding(false);
    }
  };

  const getLocalYMD = (dateObj: Date) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const toggleSave = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let newSaved = [...savedItems];
    if (newSaved.includes(id)) {
      newSaved = newSaved.filter(i => i !== id);
      showToast("Removed from saved items");
    } else {
      newSaved.push(id);
      showToast("Added to saved items!");
    }
    setSavedItems(newSaved);
    localStorage.setItem('mhtCetSavedItems', JSON.stringify(newSaved));
  };

  const toggleComplete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let newCompleted = [...completedItems];
    if (newCompleted.includes(id)) {
      newCompleted = newCompleted.filter(i => i !== id);
      showToast("Marked as unread");
    } else {
      newCompleted.push(id);
      showToast("Great! Marked as read.");
    }
    setCompletedItems(newCompleted);
    localStorage.setItem('mhtCetCompletedItems', JSON.stringify(newCompleted));
  };

  const handleAction = (item: AppMaterial) => {
    if (!completedItems.includes(item.id)) {
      toggleComplete(item.id);
    }
    if (item.linkType === 'zoom') {
      setZoomItem(item);
    } else if (item.linkType === 'youtube') {
      let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      let match = item.code.match(regExp);
      if (match && match[2].length === 11) {
        setPreviewLink('https://www.youtube.com/embed/' + match[2] + '?autoplay=1');
        setPreviewTitle(item.topic);
      } else {
        window.open(item.code, '_blank');
      }
    } else {
      if (item.code.startsWith('http')) {
        setPreviewLink(item.code);
        setPreviewTitle(item.topic);
      } else {
         window.open(`https://server.brightclass.com/api/v1/file-storage/link-by-filecode?fileCode=`+item.code);
      }
    }
  };

  const switchTab = (tabId: string) => {
    const categoriesWithSubjects = ['notes', 'live', 'tests', 'pyq', 'practice', 'formula', 'mindmaps', 'dpps'];
    if (categoriesWithSubjects.includes(tabId)) {
      setCurrentCategory(tabId);
      setCurrentTab('category-subjects');
    } else {
      setCurrentTab(tabId);
    }
    window.scrollTo(0, 0);
  };

  const getVisuals = (linkType: string) => {
    switch (linkType) {
      case 'youtube': return { bg: 'bg-red-500/10', color: 'text-red-500', actionText: 'Watch' };
      case 'zoom': return { bg: 'bg-[#2D8CFF]/10', color: 'text-[#2D8CFF]', actionText: 'Join' };
      default: return { bg: 'bg-rose-500/10', color: 'text-rose-500', actionText: 'View' };
    }
  };

  const renderItemCard = (item: AppMaterial) => {
    const isCompleted = completedItems.includes(item.id);
    const isSaved = savedItems.includes(item.id);
    const visuals = getVisuals(item.linkType);

    return (
      <div key={item.id} className={`bg-[#15161e] border ${isCompleted ? 'border-green-500/30' : 'border-gray-800'} rounded-2xl p-3.5 flex items-center gap-4 transition-colors w-full relative overflow-hidden group`}>
        {isCompleted && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l-2xl"></div>}
        
        <div className={`w-10 h-10 ${visuals.bg} rounded-lg flex items-center justify-center shrink-0 ${visuals.color} border border-transparent`}>
           <span className="font-bold text-[10px] uppercase">{item.linkType}</span>
        </div>
        <div className="flex-1 min-w-0">
            <h4 className={`text-sm font-bold ${isCompleted ? 'text-gray-300' : 'text-white'} truncate leading-tight`}>{item.topic}</h4>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-400 bg-[#090a10] px-2 py-0.5 rounded-md border border-gray-800">{item.subject}</span>
                {item.size && <span className="text-[9px] text-gray-500">{item.size}</span>}
            </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={(e) => toggleComplete(item.id, e)} className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors shrink-0">
                 <span className={isCompleted ? "text-green-500" : "text-gray-500"}>✓</span>
            </button>
            <button onClick={(e) => toggleSave(item.id, e)} className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors shrink-0">
                 <span className={isSaved ? "text-rose-500" : "text-gray-400"}>★</span>
            </button>
            <button onClick={() => handleAction(item)} className="px-3 py-2 bg-gray-800 hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm">
                {visuals.actionText}
            </button>
        </div>
      </div>
    );
  };

  if (loadingAuth) {
    return <div className="bg-[#090a10] h-screen flex items-center justify-center text-rose-500 font-bold text-xl">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="bg-[#090a10] min-h-screen flex flex-col items-center justify-center text-white px-5 font-sans">
         <img src="https://res.cloudinary.com/dygxni81n/image/upload/v1781399677/file_0000000016d0720b90d59b1433db483e_hhq2p2.png" alt="Logo" className="w-24 h-24 rounded-full border-4 border-rose-500/40 object-cover shadow-lg mb-6" />
         <h1 className="text-2xl font-bold mb-2">MHT CET Learning Hub</h1>
         <p className="text-gray-400 mb-8 text-center max-w-sm">Sign in to access your personalized learning materials, track your progress, and join live classes.</p>
         <button onClick={handleGoogleLogin} className="bg-white text-gray-900 font-bold py-3 px-6 rounded-xl flex items-center gap-3 hover:bg-gray-100 transition-colors shadow-lg">
            <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
            Sign in with Google
         </button>
      </div>
    );
  }

  if (isOnboarding) {
    return (
      <div className="bg-[#090a10] min-h-screen p-5 text-white flex flex-col font-sans items-center">
         <div className="w-full max-w-md pt-8">
           <h1 className="text-2xl font-bold mb-2">Complete Your Profile</h1>
           <p className="text-gray-400 mb-6 text-sm">Tell us a bit about yourself to get started.</p>
           <form onSubmit={handleOnboardSubmit} className="space-y-4">
              <div>
                 <label className="block text-xs text-gray-400 mb-1">Full Name</label>
                 <input type="text" value={onboardForm.name} onChange={e => setOnboardForm({...onboardForm, name: e.target.value})} required className="w-full bg-[#15161e] border border-gray-800 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-rose-500 transition-all" />
              </div>
              <div className="flex gap-3">
                 <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">Standard / Grade</label>
                    <input type="text" value={onboardForm.std} onChange={e => setOnboardForm({...onboardForm, std: e.target.value})} required placeholder="12th" className="w-full bg-[#15161e] border border-gray-800 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-rose-500 transition-all" />
                 </div>
                 <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">Class / Div</label>
                    <input type="text" value={onboardForm.class_name} onChange={e => setOnboardForm({...onboardForm, class_name: e.target.value})} required placeholder="Science-A" className="w-full bg-[#15161e] border border-gray-800 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-rose-500 transition-all" />
                 </div>
              </div>
              <div>
                 <label className="block text-xs text-gray-400 mb-1">Preparation Target</label>
                 <select value={onboardForm.prep} onChange={e => setOnboardForm({...onboardForm, prep: e.target.value})} required className="w-full bg-[#15161e] border border-gray-800 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-rose-500 transition-all">
                    <option value="">Select Target...</option>
                    <option value="MHT CET">MHT CET</option>
                    <option value="JEE">JEE Mains</option>
                    <option value="NEET">NEET</option>
                    <option value="11th">11th Standard</option>
                    <option value="10th">10th Standard</option>
                    <option value="9th">9th Standard</option>
                 </select>
              </div>
              <div>
                 <label className="block text-xs text-gray-400 mb-1">Your Phone No.</label>
                 <input type="tel" value={onboardForm.phone} onChange={e => setOnboardForm({...onboardForm, phone: e.target.value})} required className="w-full bg-[#15161e] border border-gray-800 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-rose-500 transition-all" />
              </div>
              <div>
                 <label className="block text-xs text-gray-400 mb-1">Parent's Phone No.</label>
                 <input type="tel" value={onboardForm.parent_phone} onChange={e => setOnboardForm({...onboardForm, parent_phone: e.target.value})} required className="w-full bg-[#15161e] border border-gray-800 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-rose-500 transition-all" />
              </div>
              <button type="submit" className="w-full mt-4 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg text-sm">Save Profile</button>
           </form>
         </div>
      </div>
    );
  }

  // Calculate stats for Profile
  const completedTestsCount = allMaterials.filter(m => m.category === 'tests' && completedItems.includes(m.id)).length;
  const readItems = completedItems.length;
  const completionPercent = allMaterials.length > 0 ? Math.round((readItems / allMaterials.length) * 100) : 0;

  return (
    <div className="bg-[#090a10] text-white h-[100dvh] flex flex-col font-sans overflow-hidden">
      
      {/* Sidebar */}
      <div className={`absolute inset-y-0 left-0 w-64 bg-[#15161e] border-r border-gray-800 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform z-50 flex flex-col`}>
         <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#0d0e15]">
             <div className="flex items-center gap-3">
                 <img src="https://res.cloudinary.com/dygxni81n/image/upload/v1781399677/file_0000000016d0720b90d59b1433db483e_hhq2p2.png" alt="Logo" className="w-10 h-10 rounded-full border-2 border-rose-500/40 object-cover shadow-lg" />
                 <h2 className="text-white font-bold text-lg leading-tight">MHT CET<br/><span className="text-xs font-medium text-rose-500">Learning Hub</span></h2>
             </div>
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-2">
             <button onClick={() => {setIsSidebarOpen(false); switchTab('home');}} className="w-full text-left p-3.5 rounded-xl hover:bg-gray-800 flex items-center gap-3 text-sm font-medium"><Home className="w-4 h-4 text-rose-500"/> Home</button>
             <button onClick={() => {setIsSidebarOpen(false); switchTab('profile');}} className="w-full text-left p-3.5 rounded-xl hover:bg-gray-800 flex items-center gap-3 text-sm font-medium"><User className="w-4 h-4 text-rose-500"/> My Profile</button>
             <button onClick={() => {setIsSidebarOpen(false); switchTab('saved');}} className="w-full text-left p-3.5 rounded-xl hover:bg-gray-800 flex items-center gap-3 text-sm font-medium"><Book className="w-4 h-4 text-rose-500"/> Saved Items</button>
             <button onClick={() => {setIsSidebarOpen(false); switchTab('calendar');}} className="w-full text-left p-3.5 rounded-xl hover:bg-gray-800 flex items-center gap-3 text-sm font-medium"><CalendarDays className="w-4 h-4 text-rose-500"/> Class Timeline</button>
             <hr className="border-gray-800 my-2" />
             <button onClick={() => {setIsSidebarOpen(false); handleLogout();}} className="w-full text-left p-3.5 rounded-xl hover:bg-gray-800 flex items-center gap-3 text-sm font-medium text-red-400"><LogOut className="w-4 h-4"/> Sign Out</button>
         </div>
      </div>
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="absolute inset-0 bg-black/60 z-40"></div>}

      <header className="pt-8 pb-4 px-5 flex justify-between items-center bg-[#090a10] z-10 shrink-0 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
            {currentTab !== 'home' && (
               <button onClick={() => switchTab('home')} className="text-white text-xl pr-2">←</button>
            )}
            {currentTab === 'home' && (
               <button onClick={() => setIsSidebarOpen(true)} className="text-white text-xl pr-2">☰</button>
            )}
            <h1 className="text-lg font-bold text-white tracking-wide truncate">
               {currentTab === 'home' ? 'MHT CET' : currentTab.toUpperCase()}
               {currentTab === 'home' && <span className="text-rose-500 text-sm font-semibold ml-2">12 Science</span>}
            </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-6 relative px-5 pt-4">
        {currentTab === 'home' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#2a1738] to-[#15161e] relative overflow-hidden border border-white/5 shadow-lg">
                <div className="relative z-10">
                    <h2 className="text-xl font-bold text-white mb-1">Hello, {profile?.name || 'Student'} 👋</h2>
                    <p className="text-xs text-gray-400 mb-5">Access all your study materials here.</p>
                    <div className="flex gap-6">
                        <div>
                            <div className="text-xs text-rose-500 mb-1">Total Materials</div>
                            <div className="font-bold text-2xl text-white">{allMaterials.length}</div>
                        </div>
                    </div>
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-28 bg-gradient-to-l from-[#361e47] to-transparent flex flex-col items-center justify-center border-l border-white/5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => switchTab('notes')}>
                    <div className="w-12 h-12 rounded-full border-2 border-rose-500/40 bg-[#15161e] flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.3)] mb-1 text-rose-500">
                        <Book className="w-6 h-6" />
                    </div>
                    <div className="text-[10px] text-center font-bold text-white mt-1">Materials</div>
                </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Quick Access</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-y-6 gap-x-2">
                 {[
                    { id: 'live', name: 'Live Classes', icon: Tv },
                    { id: 'tests', name: 'Mock Tests', icon: FilePenLine },
                    { id: 'notes', name: 'Notes', icon: Book },
                    { id: 'pyq', name: 'PYQ Bank', icon: Target },
                    { id: 'practice', name: 'Practice Sets', icon: Crosshair },
                    { id: 'formula', name: 'Formula Sheets', icon: FileJson },
                    { id: 'mindmaps', name: 'Mind Maps', icon: Network },
                    { id: 'calendar', name: 'Timeline', icon: CalendarDays }
                 ].map(cat => (
                    <div key={cat.id} onClick={() => switchTab(cat.id)} className="flex flex-col items-center gap-2 cursor-pointer">
                        <div className="w-14 h-14 rounded-2xl bg-[#15161e] flex items-center justify-center text-rose-500 hover:bg-[#2a1738] transition-colors shadow-sm">
                           <cat.icon className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap capitalize">{cat.name}</span>
                    </div>
                 ))}
              </div>
            </div>

            <div>
               <h3 className="text-sm font-semibold text-white mb-4">Recently Added</h3>
               <div className="space-y-3">
                 {allMaterials.slice(0, 5).map(item => renderItemCard(item))}
                 {allMaterials.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No materials available yet</p>}
               </div>
            </div>
          </div>
        )}

        {currentTab === 'category-subjects' && (
           <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {["Physics", "Chemistry", "Mathematics", "Biology", "Inorganic Chemistry", "Organic Chemistry", "Full Syllabus"].map(subj => {
                  const count = allMaterials.filter(m => m.subject === subj && (m.category === currentCategory || (!m.category && currentCategory === 'notes'))).length;
                  return (
                     <div key={subj} onClick={() => { setSelectedSubject(subj); setCurrentTab('subject-detail'); }} className="bg-[#15161e] border border-gray-800 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-800 transition-colors">
                        <div className="flex-1">
                           <h3 className="text-sm font-bold text-white truncate">{subj}</h3>
                           <p className="text-[10px] text-gray-400 mt-0.5">{count} items available</p>
                        </div>
                        <span className="text-gray-500">→</span>
                     </div>
                  );
              })}
           </div>
        )}

        {currentTab === 'subject-detail' && (
           <div className="max-w-5xl mx-auto space-y-3">
              <h2 className="text-xl font-bold mb-4">{selectedSubject}</h2>
              {allMaterials.filter(m => m.subject === selectedSubject && (m.category === currentCategory || (!m.category && currentCategory === 'notes'))).map(item => renderItemCard(item))}
           </div>
        )}

        {currentTab === 'saved' && (
           <div className="max-w-5xl mx-auto space-y-3">
              {allMaterials.filter(m => savedItems.includes(m.id)).map(item => renderItemCard(item))}
              {savedItems.length === 0 && <p className="text-gray-500 text-center py-10">No saved items</p>}
           </div>
        )}

        {currentTab === 'calendar' && (
           <div className="max-w-5xl mx-auto">
              <div className="flex overflow-x-auto gap-3 pb-4 border-b border-gray-800 mb-4 sticky top-0 bg-[#090a10] z-10 pt-2 hide-scrollbar">
                 {Array.from({length: 30}).map((_, i) => {
                     const d = new Date();
                     d.setDate(d.getDate() - i);
                     const ymd = getLocalYMD(d);
                     const isSelected = selectedCalendarDate === ymd;
                     return (
                        <button key={ymd} onClick={() => setSelectedCalendarDate(ymd)} className={`flex-shrink-0 flex flex-col items-center justify-center p-2 rounded-xl border min-w-[64px] ${isSelected ? 'bg-rose-500 text-white border-rose-500' : 'bg-[#15161e] text-gray-400 border-gray-800'}`}>
                            <span className="text-[10px] uppercase font-bold">{d.toLocaleDateString('en-US', {weekday:'short'})}</span>
                            <span className="text-xl font-black">{d.getDate()}</span>
                        </button>
                     );
                 })}
              </div>
              <div className="space-y-3">
                  {allMaterials.filter(m => m.timestamp && getLocalYMD(new Date(m.timestamp)) === selectedCalendarDate).map(item => renderItemCard(item))}
                  {allMaterials.filter(m => m.timestamp && getLocalYMD(new Date(m.timestamp)) === selectedCalendarDate).length === 0 && (
                      <p className="text-center text-gray-500 py-10">No items available for this date.</p>
                  )}
              </div>
           </div>
        )}

        {currentTab === 'profile' && (
           <div className="max-w-3xl mx-auto">
               <div className="bg-[#15161e] border border-gray-800 rounded-3xl p-6 mb-8 text-center relative overflow-hidden">
                   <div className="w-20 h-20 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold shadow-lg shadow-rose-500/10 uppercase">
                       {profile?.name ? profile.name[0] : 'S'}
                   </div>
                   <h2 className="text-2xl font-bold text-white leading-tight">{profile?.name || 'Student'}</h2>
                   <p className="text-sm text-gray-400 mt-1">{profile?.email}</p>
                   
                   <div className="flex justify-center gap-4 mt-6">
                       <span className="px-3 py-1 bg-[#090a10] border border-gray-800 rounded-lg text-xs text-rose-500 font-bold">{profile?.prep || 'MHT CET'}</span>
                       <span className="px-3 py-1 bg-[#090a10] border border-gray-800 rounded-lg text-xs text-rose-500 font-bold">Std {profile?.std || '12th'}</span>
                   </div>
               </div>

               <h3 className="text-sm font-semibold text-white mb-4">My Performance</h3>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-[#15161e] border border-gray-800 rounded-2xl p-4 text-center shadow-lg">
                      <div className="text-3xl font-black text-white">{completedTestsCount}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mt-1">Tests Taken</div>
                  </div>
                  <div className="bg-[#15161e] border border-gray-800 rounded-2xl p-4 text-center shadow-lg">
                      <div className="text-3xl font-black text-rose-500">{completionPercent}%</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mt-1">Completion Avg</div>
                  </div>
                  <div className="bg-[#15161e] border border-gray-800 rounded-2xl p-4 text-center shadow-lg">
                      <div className="text-3xl font-black text-blue-400">{readItems}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mt-1">Materials Read</div>
                  </div>
               </div>

               <div className="space-y-3">
                   <button onClick={handleLogout} className="w-full bg-[#15161e] border border-red-500/20 text-red-400 font-bold p-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors">
                       <LogOut className="w-5 h-5" /> Sign Out from Device
                   </button>
               </div>
           </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="shrink-0 h-[70px] bg-[#0c0d14] border-t border-gray-800 flex items-center justify-around z-20 pb-1 w-full relative">
          {[
              { id: 'home', icon: Home, label: 'Home' },
              { id: 'tests', icon: FilePenLine, label: 'Tests' },
              { id: 'notes', icon: Book, label: 'Notes' },
              { id: 'profile', icon: User, label: 'Profile' }
          ].map(navBtn => {
              const isActive = currentTab === navBtn.id || (currentTab === 'category-subjects' && currentCategory === navBtn.id);
              return (
                  <button key={navBtn.id} onClick={() => switchTab(navBtn.id)} className={`flex flex-col items-center gap-1 w-16 transition-colors ${isActive ? 'text-rose-500' : 'text-gray-500 hover:text-white'}`}>
                      <navBtn.icon className={`w-5 h-5 ${isActive ? 'text-rose-500' : ''}`} />
                      <span className="text-[10px] font-medium mt-0.5">{navBtn.label}</span>
                  </button>
              );
          })}
      </nav>

      {/* Media Preview Modal */}
      {previewLink && (
        <div className="absolute inset-0 z-50 bg-[#090a10] flex flex-col">
            <div className="h-14 flex items-center justify-between px-4 bg-[#15161e] border-b border-gray-800 shrink-0">
               <h3 className="text-white font-bold text-sm truncate">{previewTitle}</h3>
               <div className="flex gap-2">
                   <button onClick={() => window.open(previewLink)} className="p-2 text-gray-400">↗</button>
                   <button onClick={() => setPreviewLink(null)} className="p-2 text-gray-400">X</button>
               </div>
            </div>
            <div className="flex-1 w-full bg-black">
                {previewLink.includes('youtube') ? (
                  <iframe src={previewLink} className="w-full h-full border-none" allowFullScreen></iframe>
                ) : (
                   <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewLink)}&embedded=true`} className="w-full h-full border-none"></iframe>
                )}
            </div>
        </div>
      )}

      {/* Zoom Modal */}
      {zoomItem && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
             <div className="bg-[#15161e] border border-gray-800 w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl">
                 <h3 className="text-xl font-bold text-white mb-4">Zoom Class</h3>
                 <p className="text-gray-400 mb-4">{zoomItem.topic}</p>
                 <div className="bg-[#090a10] border border-gray-800 p-4 rounded-xl mb-4 text-left font-mono space-y-2">
                     <div className="text-white text-sm"><span className="text-gray-500 text-xs mr-2">ID:</span> {zoomItem.meetingId || 'N/A'}</div>
                     <div className="text-white text-sm"><span className="text-gray-500 text-xs mr-2">Pass:</span> {zoomItem.passcode || 'N/A'}</div>
                 </div>
                 <div className="flex gap-3">
                     <button onClick={() => setZoomItem(null)} className="flex-1 py-3 bg-gray-800 rounded-xl text-white font-bold">Close</button>
                     <a href={zoomItem.code} target="_blank" rel="noreferrer" className="flex-1 py-3 bg-[#2D8CFF] text-white rounded-xl font-bold shadow-lg shadow-[#2D8CFF]/20">Join Video</a>
                 </div>
             </div>
         </div>
      )}

      {/* Toast */}
      {toastVisible && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-full bg-[#15161e] border border-gray-700 shadow-2xl text-sm font-medium text-white flex items-center gap-2`}>
            <span className="text-rose-500 font-bold">✓</span>
            <span className="truncate">{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
