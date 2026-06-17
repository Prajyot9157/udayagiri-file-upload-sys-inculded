import React, { useState, useEffect } from 'react';
import { db } from '../firebaseClient';
import { supabase } from '../supabaseClient';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { AppMaterial } from '../types';

export default function AdminApp() {
  const [activeTab, setActiveTab] = useState('materials');
  const [allData, setAllData] = useState<AppMaterial[]>([]);
  const [usersInfo, setUsersInfo] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<AppMaterial[]>([]);
  
  const [searchVal, setSearchVal] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [editId, setEditId] = useState<string>('');
  const [upCategory, setUpCategory] = useState('notes');
  const [upSubject, setUpSubject] = useState('Physics');
  const [upLinkType, setUpLinkType] = useState('pdf');
  const [upTopic, setUpTopic] = useState('');
  const [upCode, setUpCode] = useState('');
  const [upSize, setUpSize] = useState('');
  const [upZoomId, setUpZoomId] = useState('');
  const [upZoomPass, setUpZoomPass] = useState('');
  const [upDate, setUpDate] = useState('');
  
  // For file upload
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastIsError, setToastIsError] = useState(false);

  const showToast = (msg: string, isError = false) => {
    setToastMsg(msg);
    setToastIsError(isError);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  useEffect(() => {
    const materialsRef = ref(db, 'study_text_entries');
    const unsubscribe = onValue(materialsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const items = Object.keys(data).map(key => ({ id: key, ...data[key] })) as AppMaterial[];
      items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setAllData(items);
    });

    fetchUsers();

    return () => unsubscribe();
  }, []);

  const fetchUsers = async () => {
     const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
     if (data) setUsersInfo(data);
  };

  useEffect(() => {
    let filtered = allData.filter(item => {
      const matchesSearch = item.topic?.toLowerCase().includes(searchVal.toLowerCase());
      const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
      const normalizedType = item.linkType || 'pdf';
      const matchesType = filterType === 'all' || normalizedType === filterType;
      
      return matchesSearch && matchesCategory && matchesType;
    });
    setFilteredData(filtered);
  }, [allData, searchVal, filterType, filterCategory]);

  const openUploadModal = (id?: string) => {
    if (id) {
      const item = allData.find(d => d.id === id);
      if (item) {
        setEditId(item.id);
        setUpCategory(item.category || 'notes');
        setUpSubject(item.subject || 'Physics');
        setUpLinkType(item.linkType || 'pdf');
        setUpTopic(item.topic || '');
        setUpCode(item.code || '');
        setUpSize(item.size || '');
        setUpZoomId(item.meetingId || '');
        setUpZoomPass(item.passcode || '');
        
        if (item.timestamp) {
          const itemDate = new Date(item.timestamp);
          const localDateStr = `${itemDate.getFullYear()}-${String(itemDate.getMonth()+1).padStart(2,'0')}-${String(itemDate.getDate()).padStart(2,'0')}`;
          setUpDate(localDateStr);
        } else {
          setUpDate('');
        }
      }
    } else {
      setEditId('');
      setUpCategory('notes');
      setUpSubject('Physics');
      setUpLinkType('pdf');
      setUpTopic('');
      setUpCode('');
      setUpSize('');
      setUpZoomId('');
      setUpZoomPass('');
      setUpDate('');
      setFileToUpload(null);
    }
    setIsUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setFileToUpload(null);
  };

  const handleUploadFileToSupabase = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('materials')
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('materials')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    let finalCode = upCode.trim();

    try {
      if (fileToUpload) {
        finalCode = await handleUploadFileToSupabase(fileToUpload);
      } else if (!finalCode && upLinkType !== 'zoom') {
         throw new Error("Please provide a link or upload a file");
      }

      let targetTimestamp = Date.now();
      if (upDate) {
        const [year, month, day] = upDate.split('-');
        targetTimestamp = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0).getTime();
      }

      const payload: Omit<AppMaterial, 'id'> = {
        category: upCategory,
        subject: upSubject,
        linkType: upLinkType,
        topic: upTopic.trim(),
        code: finalCode,
        size: upSize.trim(),
        meetingId: upLinkType === 'zoom' ? upZoomId.trim() : '',
        passcode: upLinkType === 'zoom' ? upZoomPass.trim() : '',
        timestamp: targetTimestamp
      };

      if (editId) {
        const itemRef = ref(db, `study_text_entries/${editId}`);
        await update(itemRef, { ...payload, lastModified: Date.now() });
        showToast("Asset properties updated");
      } else {
        const itemsRef = ref(db, 'study_text_entries');
        await push(itemsRef, payload);
        showToast("Asset saved to live repository");
      }
      closeUploadModal();
    } catch (err: any) {
      showToast(err.message || "Live transaction aborted", true);
    } finally {
      setIsUploading(false);
    }
  };

  const confirmDelete = (id: string) => {
    setPendingDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await remove(ref(db, `study_text_entries/${pendingDeleteId}`));
      showToast("Asset deleted permanently");
    } catch (e) {
      showToast("Aborted deletion", true);
    }
    setIsDeleteModalOpen(false);
    setPendingDeleteId(null);
  };

  return (
    <div className="bg-[#090a10] text-white min-h-screen flex flex-col font-sans">
      <header className="p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-[#15161e] border-b border-gray-800 shrink-0 relative z-20">
        <div className="flex items-center gap-4">
          <img src="https://res.cloudinary.com/dygxni81n/image/upload/v1781399677/file_0000000016d0720b90d59b1433db483e_hhq2p2.png" alt="Admin Logo" className="w-12 h-12 rounded-full border-2 border-rose-500 shadow-lg object-cover shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-none text-white tracking-wide truncate">Control Center</h1>
            <p className="text-xs text-rose-500 mt-1 font-medium truncate">Manage Zoom, YouTube & Files</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
          <div className="flex bg-[#090a10] border border-gray-800 rounded-xl p-1 shrink-0">
             <button onClick={() => setActiveTab('materials')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'materials' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Materials</button>
             <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Users</button>
          </div>
          {activeTab === 'materials' && (
             <button onClick={() => openUploadModal()} className="px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all shrink-0 ml-2">
               + Add New
             </button>
          )}
        </div>
      </header>

      {activeTab === 'users' ? (
         <main className="flex-1 overflow-y-auto px-5 py-6">
            <h2 className="text-xl font-bold mb-4">Registered Users <span className="text-gray-500 text-sm font-normal ml-2">({usersInfo.length})</span></h2>
            <div className="bg-[#15161e] border border-gray-800/80 rounded-2xl overflow-hidden shrink-0">
               <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm text-gray-300">
                      <thead className="bg-[#090a10] text-xs uppercase text-gray-500 border-b border-gray-800">
                         <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Target / Std</th>
                            <th className="px-6 py-4">Phone</th>
                            <th className="px-6 py-4">Parent Phone</th>
                            <th className="px-6 py-4 text-right">Joined</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                         {usersInfo.map(u => (
                            <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                               <td className="px-6 py-4">
                                  <div className="font-bold text-white">{u.name}</div>
                                  <div className="text-[10px] text-gray-500 mt-0.5">{u.email}</div>
                               </td>
                               <td className="px-6 py-4">
                                  <span className="text-rose-500 font-bold">{u.prep}</span>
                                  <div className="text-xs text-gray-400 mt-0.5">{u.std} • {u.class_name}</div>
                               </td>
                               <td className="px-6 py-4 font-mono text-xs">{u.phone}</td>
                               <td className="px-6 py-4 font-mono text-xs">{u.parent_phone}</td>
                               <td className="px-6 py-4 text-right text-[10px] whitespace-nowrap text-gray-500 block sm:table-cell">
                                  {new Date(u.created_at).toLocaleDateString()}
                               </td>
                            </tr>
                         ))}
                         {usersInfo.length === 0 && (
                            <tr>
                               <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No users found.</td>
                            </tr>
                         )}
                      </tbody>
                   </table>
               </div>
            </div>
         </main>
      ) : (
         <>
      <section className="px-5 pt-4 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <div className="bg-[#15161e] border border-gray-800/80 p-3.5 rounded-2xl w-full">
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider truncate">Total Items</p>
          <h3 className="text-2xl font-black text-white mt-1">{allData.length}</h3>
        </div>
        <div className="bg-[#15161e] border border-gray-800/80 p-3.5 rounded-2xl w-full">
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider truncate">Zoom Meetings</p>
            <h3 className="text-2xl font-black text-blue-400 mt-1">{allData.filter(d => d.linkType === 'zoom').length}</h3>
        </div>
        <div className="bg-[#15161e] border border-gray-800/80 p-3.5 rounded-2xl w-full">
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider truncate">YouTube Videos</p>
            <h3 className="text-2xl font-black text-red-500 mt-1">{allData.filter(d => d.linkType === 'youtube').length}</h3>
        </div>
        <div className="bg-[#15161e] border border-gray-800/80 p-3.5 rounded-2xl w-full">
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider truncate">Active Files</p>
            <h3 className="text-2xl font-black text-sky-400 mt-1">{allData.filter(d => d.linkType === 'pdf' || !d.linkType).length}</h3>
        </div>
      </section>

      <section className="p-5 pb-2 flex flex-col lg:flex-row gap-3 shrink-0">
        <div className="flex-1 relative w-full">
          <input type="text" value={searchVal} onChange={e => setSearchVal(e.target.value)} placeholder="Search topics, papers or links..." className="w-full bg-[#15161e] border border-gray-800 rounded-xl py-3 pl-4 pr-4 text-sm text-white outline-none focus:border-rose-500 transition-all" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="flex-1 sm:flex-none bg-[#15161e] border border-gray-800 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-rose-500 cursor-pointer">
              <option value="all">All Types</option>
              <option value="pdf">Files / PDFs</option>
              <option value="youtube">YouTube Videos</option>
              <option value="zoom">Zoom Streams</option>
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="flex-1 sm:flex-none bg-[#15161e] border border-gray-800 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-rose-500 cursor-pointer">
              <option value="all">All Categories</option>
              <option value="notes">Notes</option>
              <option value="live">Live Classes</option>
              <option value="tests">Mock Tests</option>
              <option value="pyq">PYQ Bank</option>
              <option value="practice">Practice Sets</option>
              <option value="formula">Formula Sheets</option>
              <option value="mindmaps">Mind Maps</option>
              <option value="dpps">DPPs</option>
          </select>
        </div>
      </section>

      <main className="flex-1 overflow-y-auto px-5 pb-6 grid grid-cols-1 xl:grid-cols-2 gap-4 content-start">
        {filteredData.length === 0 ? (
          <div className="col-span-1 xl:col-span-2 text-center py-12 text-gray-500 w-full relative h-[60vh]">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-semibold text-white">No matching resources</p>
              <p className="text-xs mt-1 text-gray-400">Adjust your filters or add a new material.</p>
            </div>
          </div>
        ) : (
          filteredData.map(item => (
            <div key={item.id} className="bg-[#15161e] border border-gray-800/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:border-gray-700 transition-colors w-full">
              <div className="flex-1 min-w-0 w-full">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-white bg-rose-500 px-2.5 py-1 rounded-md">{item.category || 'Notes'}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-800/80 border border-gray-800 px-2 py-0.5 rounded-md font-medium">{item.subject}</span>
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded">{item.linkType || 'pdf'}</span>
                </div>
                <h4 className="text-sm font-bold text-white truncate max-w-full md:max-w-md w-full">{item.topic}</h4>
                <div className="text-[10px] text-gray-500 mt-1.5 flex gap-3 overflow-hidden">
                    <span className="bg-[#090a10] px-2 py-1 rounded border border-gray-800/40 font-mono truncate max-w-[150px] sm:max-w-[200px]">Link: {item.code}</span>
                    {item.timestamp && <span className="bg-[#090a10] px-2 py-1 rounded border border-gray-800/40 text-rose-500 shrink-0">{new Date(item.timestamp).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 self-stretch md:self-auto pt-3 md:pt-0 border-t border-gray-800/40 md:border-none w-full md:w-auto shrink-0">
                  <a href={item.code} target="_blank" rel="noreferrer" className="flex-1 md:flex-none h-10 px-3.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-all text-xs font-bold flex items-center justify-center gap-1.5 border border-gray-700 shrink-0">
                      Preview
                  </a>
                  <button onClick={() => openUploadModal(item.id)} className="w-10 h-10 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-xl transition-all flex items-center justify-center border border-indigo-500/20 shrink-0">
                      Edit
                  </button>
                  <button onClick={() => confirmDelete(item.id)} className="w-10 h-10 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all flex items-center justify-center border border-red-500/20 shrink-0">
                      Del
                  </button>
              </div>
          </div>
          ))
        )}
      </main>
      </>
      )}

      {/* Upload/Edit Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#15161e] w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-gray-800 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">{editId ? 'Edit Asset' : 'Upload Asset'}</h3>
              <button onClick={closeUploadModal} className="text-gray-400 hover:text-white flex items-center justify-center">Close</button>
            </div>
            
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-xs text-gray-400 mb-1">Category</label>
                      <select value={upCategory} onChange={e => setUpCategory(e.target.value)} className="w-full bg-[#1a1b26] border border-gray-700 rounded-xl p-3 text-white text-sm outline-none focus:border-rose-500">
                          <option value="notes">Notes</option>
                          <option value="live">Live Classes</option>
                          <option value="tests">Mock Tests</option>
                          <option value="pyq">PYQ Bank</option>
                          <option value="practice">Practice Sets</option>
                          <option value="formula">Formula Sheet</option>
                          <option value="mindmaps">Mind Maps</option>
                          <option value="dpps">DPPs</option>
                      </select>
                  </div>
                  <div>
                      <label className="block text-xs text-gray-400 mb-1">Subject</label>
                      <select value={upSubject} onChange={e => setUpSubject(e.target.value)} className="w-full bg-[#1a1b26] border border-gray-700 rounded-xl p-3 text-white text-sm outline-none focus:border-rose-500">
                          <option value="Physics">Physics</option>
                          <option value="Chemistry">Chemistry</option>
                          <option value="Mathematics">Mathematics</option>
                          <option value="Biology">Biology</option>
                          <option value="Inorganic Chemistry">Inorganic Chemistry</option>
                          <option value="Organic Chemistry">Organic Chemistry</option>
                          <option value="Full Syllabus">Full Syllabus / General</option>
                      </select>
                  </div>
              </div>

              <div>
                  <label className="block text-xs text-gray-400 mb-1">Link Integration Target</label>
                  <select value={upLinkType} onChange={e => setUpLinkType(e.target.value)} className="w-full bg-[#1a1b26] border border-gray-700 rounded-xl p-3 text-white text-sm outline-none focus:border-rose-500">
                      <option value="pdf">Standard Document / File</option>
                      <option value="youtube">YouTube Video Embed</option>
                      <option value="zoom">Zoom Live Stream</option>
                  </select>
              </div>
              
              <div>
                  <label className="block text-xs text-gray-400 mb-1">Topic Title</label>
                  <input type="text" value={upTopic} onChange={e => setUpTopic(e.target.value)} placeholder="e.g. Rotational Dynamics L-2" className="w-full bg-[#1a1b26] border border-gray-700 rounded-xl p-3 text-white text-sm outline-none focus:border-rose-500" required />
              </div>
              
              {upLinkType === 'pdf' ? (
                <div className="bg-[#1a1b26] border border-gray-700 rounded-xl p-3 text-white">
                  <label className="block text-xs text-gray-400 mb-2">Upload File (Supabase Storage) OR Provide Direct Link</label>
                  
                  <div className="relative mb-2">
                    <input 
                       type="file"
                       id="file-upload"
                       onChange={e => setFileToUpload(e.target.files ? e.target.files[0] : null)}
                       className="hidden"
                    />
                    <label 
                      htmlFor="file-upload" 
                      className="flex flex-col items-center justify-center w-full h-32 px-4 transition border-2 border-gray-700 border-dashed rounded-xl appearance-none cursor-pointer hover:border-rose-500 hover:bg-[#15161e] focus:outline-none"
                    >
                      <span className="flex items-center space-x-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="font-medium text-gray-400">
                          {fileToUpload ? <span className="text-rose-500">{fileToUpload.name}</span> : 'Drop files to Attach, or click to browse'}
                        </span>
                      </span>
                    </label>
                  </div>

                  <input type="text" value={upCode} onChange={e => setUpCode(e.target.value)} placeholder="Or paste direct URL..." className="w-full bg-[#0d0e15] border border-gray-800 rounded-lg p-2 text-white text-sm outline-none focus:border-rose-500 mt-2" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Resource Link</label>
                  <input type="text" value={upCode} onChange={e => setUpCode(e.target.value)} placeholder="Resource link URL..." className="w-full bg-[#1a1b26] border border-gray-700 rounded-xl p-3 text-white text-sm outline-none focus:border-rose-500" required />
                </div>
              )}

              {upLinkType === 'zoom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0d0e15] p-3 rounded-2xl border border-gray-800">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Meeting ID</label>
                        <input type="text" value={upZoomId} onChange={e => setUpZoomId(e.target.value)} placeholder="ID" className="w-full bg-[#1a1b26] border border-gray-700 rounded-xl p-2 text-white text-sm outline-none focus:border-rose-500" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Passcode</label>
                        <input type="text" value={upZoomPass} onChange={e => setUpZoomPass(e.target.value)} placeholder="Pass" className="w-full bg-[#1a1b26] border border-gray-700 rounded-xl p-2 text-white text-sm outline-none focus:border-rose-500" />
                    </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-xs text-gray-400 mb-1">Display Metadata</label>
                      <input type="text" value={upSize} onChange={e => setUpSize(e.target.value)} placeholder="e.g. 1.8 MB" className="w-full bg-[#1a1b26] border border-gray-700 rounded-xl p-3 text-white text-sm outline-none focus:border-rose-500" />
                  </div>
                  <div>
                      <label className="block text-xs text-gray-400 mb-1">Timeline Date</label>
                      <input type="date" value={upDate} onChange={e => setUpDate(e.target.value)} className="w-full bg-[#1a1b26] border border-gray-700 rounded-xl p-3 text-gray-400 outline-none focus:border-rose-500" />
                  </div>
              </div>

              <button disabled={isUploading} type="submit" className="w-full mt-4 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                   {isUploading ? 'Saving...' : 'Save Asset'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-5">
            <div className="bg-[#15161e] w-full max-w-sm rounded-3xl p-6 text-center border border-gray-800 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-2">Delete Item?</h3>
                <p className="text-gray-400 text-sm mb-6">This item will be instantly removed.</p>
                <div className="flex gap-3">
                    <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-gray-800 rounded-xl text-white font-medium">Cancel</button>
                    <button onClick={handleDelete} className="flex-1 py-3 bg-red-500 rounded-xl text-white font-medium shadow-lg shadow-red-500/20">Delete</button>
                </div>
            </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastVisible && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-full bg-[#15161e] border border-gray-700 shadow-2xl text-sm font-medium text-white flex items-center gap-2`}>
            {toastIsError ? <span className="text-red-500">!</span> : <span className="text-rose-500">✓</span>}
            <span className="truncate">{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
