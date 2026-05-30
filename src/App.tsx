
import React, { useEffect, useState, useMemo } from 'react';
import { 
  Search, 
  RefreshCw, 
  Users, 
  School, 
  Calendar, 
  Phone, 
  User, 
  ArrowRight, 
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  Clock,
  ExternalLink,
  CheckCircle,
  Lock,
  LogOut
} from 'lucide-react';
import { fetchSpreadsheetData, fetchKonsultanOptions, saveConfirmation, isAppScriptConfigured } from './api';
import { SpreadsheetRow } from './types';
import { cn } from './utils/cn';

const USERS = [
  { username: 'semarang1', password: '443', branch: 'Semarang-1' },
  { username: 'semarang2', password: '444', branch: 'Semarang-2' },
  { username: 'semarang4', password: '442', branch: 'Semarang-4' },
  { username: 'semarang5', password: '461', branch: 'Semarang-5' },
  { username: 'semarang6', password: '465', branch: 'Semarang-6' },
  { username: 'kendal', password: '448', branch: 'Kendal' },
  { username: 'salatiga', password: '219', branch: 'Salatiga' },
];

// Helper untuk membersihkan string agar perbandingan lebih akurat (fuzzier matching)
const cleanStr = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

function App() {
  const [user, setUser] = useState<{ username: string; branch: string } | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [data, setData] = useState<SpreadsheetRow[]>([]);
  const [konsultanOptions, setKonsultanOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedItem, setSelectedItem] = useState<SpreadsheetRow | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    tanggalKonsultasi: '',
    waktuKonsultasi: '',
    konsultan: ''
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [dataResult, konsultanResult] = await Promise.all([
          fetchSpreadsheetData(),
          fetchKonsultanOptions()
        ]);
        setData(dataResult);
        setKonsultanOptions(konsultanResult);
      } catch (err) {
        setError('Gagal memuat data dari spreadsheet. Pastikan spreadsheet bersifat publik.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [refreshKey]);



  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = USERS.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (foundUser) {
      const sessionUser = { username: foundUser.username, branch: foundUser.branch };
      setUser(sessionUser);
      localStorage.setItem('user', JSON.stringify(sessionUser));
      setLoginError('');
    } else {
      setLoginError('Username atau Password salah!');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const openConfirmationModal = (item: SpreadsheetRow) => {
    setSelectedItem(item);
    setEditForm({
      // Konversi ke YYYY-MM-DD untuk input date jika sudah dalam format lain
      tanggalKonsultasi: item.tanggalKonsultasi ? formatDateForInput(item.tanggalKonsultasi) : '',
      waktuKonsultasi: item.waktuKonsultasi || '',
      konsultan: item.konsultan || ''
    });
    setIsEditing(true);
  };

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async () => {
    if (!selectedItem) return;

    const isConfirmed = editForm.tanggalKonsultasi && editForm.waktuKonsultasi && editForm.konsultan;
    const newStatus = isConfirmed ? 'Terkonfirmasi' : 'Belum Dikonfirmasi';
    
    // Konversi tanggal dari YYYY-MM-DD (input date) ke DD-MM-YYYY untuk Sheets
    const tanggalFormatted = editForm.tanggalKonsultasi ? formatDateDisplay(editForm.tanggalKonsultasi) : '';
    
    const payload = {
      timestamp: selectedItem.timestamp,
      namaSiswa: selectedItem.namaSiswa,
      tanggalKonsultasi: tanggalFormatted,
      waktuKonsultasi: editForm.waktuKonsultasi,
      konsultan: editForm.konsultan,
      status: newStatus
    };

    // Update lokal dulu agar UI langsung merespons
    const updatedData = data.map(item => {
      if (item.timestamp === selectedItem.timestamp && item.namaSiswa === selectedItem.namaSiswa) {
        return { 
          ...item, 
          tanggalKonsultasi: tanggalFormatted, 
          waktuKonsultasi: editForm.waktuKonsultasi, 
          konsultan: editForm.konsultan, 
          status: newStatus 
        };
      }
      return item;
    });
    setData(updatedData);
    setIsEditing(false);
    setSelectedItem(null);

    // Kirim ke Google Apps Script
    const result = await saveConfirmation(payload);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'info');
    }
  };

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'terkonfirmasi') return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20';
    if (s === 'belum dikonfirmasi') return 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20';
    return 'bg-slate-50 text-slate-600 border-slate-200 ring-slate-500/20';
  };

  /**
   * Normalize berbagai format tanggal ke YYYY-MM-DD untuk input date
   */
  const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return '';
    
    // Sudah dalam format YYYY-MM-DD
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return dateStr.substring(0, 10);
    
    // Format DD/MM/YYYY atau DD-MM-YYYY
    const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    
    // Format dari Apps Script: "30/05/2026 17:10 WIB"
    const appsMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (appsMatch) {
      const [, d, m, y] = appsMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    
    // Coba parse dengan Date
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {}
    
    return '';
  };

  /**
   * Format tanggal untuk ditampilkan: DD-MM-YYYY
   */
  const formatDateDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const normalized = normalizeDate(dateStr);
    if (!normalized) {
      // Jika sudah dalam format yang tidak bisa diparse, return as-is
      return dateStr;
    }
    const [y, m, d] = normalized.split('-');
    return `${d}-${m}-${y}`;
  };

  /**
   * Format untuk input type="date" (YYYY-MM-DD)
   */
  const formatDateForInput = (dateStr: string): string => {
    return normalizeDate(dateStr);
  };

  const parseTimeRange = (timeStr: string) => {
    if (!timeStr) return { start: '', end: '' };
    const parts = timeStr.split('-').map(p => p.trim());
    return {
      start: parts[0] || '',
      end: parts[1] || ''
    };
  };

  const formatTimeRange = (start: string, end: string) => {
    if (!start && !end) return '';
    if (start && !end) return start;
    if (!start && end) return end;
    return `${start} - ${end}`;
  };

  // Branch data filtering
  const branchFilteredData = useMemo(() => {
    if (!user) return [];
    
    const userBranchClean = cleanStr(user.branch); // misal: "semarang1"
    
    return data.filter(item => {
      if (!item.tempatKonsultasi) return false;
      
      const itemBranchClean = cleanStr(item.tempatKonsultasi); // misal: "kantorcabangsemarang1"
      
      // Cek apakah "semarang1" ada di dalam "kantorcabangsemarang1"
      return itemBranchClean.includes(userBranchClean);
    });
  }, [data, user]);

  const processedDataForUser = useMemo(() => {
    return branchFilteredData.map(item => {
      const isConfirmed = item.tanggalKonsultasi && item.waktuKonsultasi && item.konsultan;
      return {
        ...item,
        status: isConfirmed ? 'Terkonfirmasi' : 'Belum Dikonfirmasi'
      };
    });
  }, [branchFilteredData]);

  const filteredDataForUser = useMemo(() => {
    const filtered = processedDataForUser.filter(item => {
      const matchesSearch = 
        item.namaSiswa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.asalSekolah.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.noWhatsappSiswa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.konsultan.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // Urutkan: "Belum Dikonfirmasi" di atas, lalu berdasarkan Timestamp terbaru
    return [...filtered].sort((a, b) => {
      // Prioritas 1: Status (Belum Dikonfirmasi di atas)
      if (a.status === 'Belum Dikonfirmasi' && b.status !== 'Belum Dikonfirmasi') return -1;
      if (a.status !== 'Belum Dikonfirmasi' && b.status === 'Belum Dikonfirmasi') return 1;
      
      // Prioritas 2: Timestamp (Terbaru di atas)
      // Mencoba membandingkan string timestamp secara terbalik karena format biasanya DD/MM/YYYY
      // Untuk akurasi tinggi biasanya diparse ke Date, tapi untuk tampilan dashboard, 
      // membalikkan string YYYYMMDDHHMMSS sering digunakan untuk sort cepat.
      return b.timestamp.localeCompare(a.timestamp); 
    });
  }, [processedDataForUser, searchTerm, statusFilter]);

  const statsForUser = useMemo(() => {
    const total = processedDataForUser.length;
    const byStatus = processedDataForUser.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, byStatus };
  }, [processedDataForUser]);

  const statusOptionsForUser = useMemo(() => {
    const statuses = Array.from(new Set(processedDataForUser.map(item => item.status))).filter(Boolean);
    return ['All', ...statuses];
  }, [processedDataForUser]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-indigo-600 p-8 text-center">
            <div className="inline-flex p-3 bg-white/10 rounded-xl mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Login Dashboard</h1>
            <p className="text-indigo-100 mt-2">Masuk untuk mengelola data siswa</p>
          </div>
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg font-medium">
                {loginError}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                  placeholder="Masukkan username"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="password" 
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                  placeholder="Masukkan password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                />
              </div>
            </div>
            <button 
              type="submit"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              Masuk Sekarang
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
          <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">Gunakan kredensial kantor cabang Anda</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Users className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Monitoring Data SPMB
              </h1>
              <p className="text-xs font-medium text-indigo-600">{user.branch}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border",
              isAppScriptConfigured() 
                ? "bg-green-50 text-green-700 border-green-200" 
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isAppScriptConfigured() ? "bg-green-500" : "bg-amber-500"
              )}></div>
              {isAppScriptConfigured() ? 'Database: Connected' : 'Mode: Local Only'}
            </div>
          </div>
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Total Data" 
            value={statsForUser.total} 
            icon={<Users className="w-6 h-6" />} 
            color="indigo" 
          />
          <StatCard 
            title="Siswa Terdaftar" 
            value={processedDataForUser.length} 
            icon={<School className="w-6 h-6" />} 
            color="emerald" 
          />
          <StatCard 
            title="Update Terbaru" 
            value={processedDataForUser.length > 0 ? formatDateDisplay(processedDataForUser[0].timestamp.split(',')[0]) : '-'} 
            icon={<Calendar className="w-6 h-6" />} 
            color="amber" 
            isText
          />
          <StatCard 
            title="Konsultan Aktif" 
            value={new Set(processedDataForUser.map(d => d.konsultan).filter(k => k && k.trim() !== '')).size} 
            icon={<User className="w-6 h-6" />} 
            color="violet" 
          />
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="Cari nama, sekolah, atau WhatsApp..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-slate-400 w-5 h-5" />
            <select 
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptionsForUser.map(opt => (
                <option key={opt} value={opt}>{opt === 'All' ? 'Semua Status' : opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
              <RefreshCw className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-slate-400 font-bold mt-6 tracking-widest text-[10px] uppercase">Syncing Data...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50/50 border border-red-100 p-10 rounded-[2.5rem] text-center max-w-2xl mx-auto shadow-sm">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Sync Error</h3>
            <p className="text-slate-500 text-sm mb-6">{error}</p>
            <button 
              onClick={handleRefresh}
              className="px-8 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-200"
            >
              TRY AGAIN
            </button>
          </div>
        ) : filteredDataForUser.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm text-slate-400">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 opacity-20" />
            </div>
            <p className="text-lg font-black text-slate-900 mb-1">No results found</p>
            <p className="text-sm font-medium mb-6">Try adjusting your filters or search term</p>
            <button onClick={() => {setSearchTerm(''); setStatusFilter('All');}} className="px-6 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-all text-xs tracking-wider uppercase">Reset All Filters</button>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Student Details</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">School</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Schedule</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Consultant</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Status & Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredDataForUser.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/30 transition-all group">
                      <td className="px-8 py-6 align-top">
                        <button 
                          onClick={() => {setSelectedItem(item); setIsEditing(false);}}
                          className="font-black text-slate-900 hover:text-indigo-600 text-left transition-colors block text-base leading-tight"
                        >
                          {item.namaSiswa}
                        </button>
                        <div className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1.5 uppercase tracking-wider">
                          <Clock className="w-3 h-3" />
                          {formatDateDisplay(item.timestamp.split(',')[0])}
                        </div>
                      </td>
                      <td className="px-8 py-6 align-top">
                        <div className="text-sm text-slate-600 font-bold bg-slate-100/50 w-fit px-3 py-1 rounded-lg border border-slate-200/50">{item.asalSekolah}</div>
                      </td>
                      <td className="px-8 py-6 align-top">
                        <a 
                          href={`https://wa.me/${item.noWhatsappSiswa.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50/80 px-4 py-2 rounded-xl transition-all hover:shadow-lg hover:shadow-indigo-100 border border-indigo-100"
                        >
                          <Phone className="w-4 h-4" /> {item.noWhatsappSiswa}
                        </a>
                      </td>
                      <td className="px-8 py-6 align-top">
                        {item.tanggalKonsultasi ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                              <Calendar className="w-4 h-4 text-indigo-500" />
                              {formatDateDisplay(item.tanggalKonsultasi)}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 ml-6 bg-slate-50 px-2 py-0.5 rounded-md w-fit">
                              {item.waktuKonsultasi}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs font-bold italic text-slate-300">
                            <Calendar className="w-4 h-4 opacity-30" />
                            Not Scheduled
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6 align-top">
                        <div className="text-sm font-black text-slate-700">
                          {item.konsultan ? (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600">
                                {item.konsultan.substring(0,2).toUpperCase()}
                              </div>
                              {item.konsultan}
                            </div>
                          ) : (
                            <span className="text-slate-200">Pending</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 align-top text-right">
                        <div className="flex flex-col gap-3 items-end">
                          <span className={cn(
                            "inline-flex items-center justify-center px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest ring-4 shadow-sm",
                            getStatusColor(item.status)
                          )}>
                            {item.status}
                          </span>
                          <button 
                            onClick={() => openConfirmationModal(item)}
                            className={cn(
                              "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[10px] font-black rounded-xl transition-all shadow-sm group-hover:shadow-xl group-hover:shadow-indigo-100 border uppercase tracking-wider",
                              item.status === 'Terkonfirmasi' 
                                ? "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200" 
                                : "bg-gradient-to-r from-indigo-600 to-violet-700 text-white border-transparent hover:shadow-indigo-200 transform hover:-translate-y-0.5"
                            )}
                          >
                            {item.status === 'Terkonfirmasi' ? (
                              <>
                                <ArrowRight className="w-4 h-4" />
                                Edit Schedule
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Schedule Now
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-sm text-slate-500">
              <p>Menampilkan {filteredDataForUser.length} dari {processedDataForUser.length} entri</p>
              <div className="flex items-center gap-2">
                <button className="p-1 border border-slate-200 rounded hover:bg-white disabled:opacity-50" disabled><ChevronLeft className="w-4 h-4" /></button>
                <button className="p-1 border border-slate-200 rounded hover:bg-white disabled:opacity-50" disabled><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Detail Siswa</h2>
              <button 
                onClick={() => setSelectedItem(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Informasi Siswa</label>
                  <div className="mt-3 space-y-4">
                    <DetailItem icon={<User />} label="Nama Siswa" value={selectedItem.namaSiswa} />
                    <DetailItem icon={<School />} label="Asal Sekolah" value={selectedItem.asalSekolah} />
                    <DetailItem icon={<Phone />} label="WhatsApp Siswa" value={selectedItem.noWhatsappSiswa} isPhone />
                    <DetailItem icon={<MapPin />} label="Alamat" value={selectedItem.alamatRumah} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Edit Konsultasi</label>
                  <div className="mt-3 space-y-4">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1 font-semibold">Tanggal Konsultasi</label>
                          <div className="relative flex items-center">
                            <Calendar className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input 
                              type="date" 
                              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                              value={formatDateForInput(editForm.tanggalKonsultasi)}
                              onChange={(e) => {
                                // Simpan dalam format YYYY-MM-DD, akan diformat saat display
                                setEditForm({...editForm, tanggalKonsultasi: e.target.value});
                              }}
                            />
                          </div>
                          {editForm.tanggalKonsultasi && (
                            <p className="text-[10px] text-slate-400 mt-1 ml-1">
                              Tampil: {formatDateDisplay(editForm.tanggalKonsultasi)}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Waktu Konsultasi (Range)</label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <input 
                                type="time" 
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={parseTimeRange(editForm.waktuKonsultasi).start}
                                onChange={(e) => {
                                  const { end } = parseTimeRange(editForm.waktuKonsultasi);
                                  setEditForm({...editForm, waktuKonsultasi: formatTimeRange(e.target.value, end)});
                                }}
                              />
                            </div>
                            <span className="text-slate-400">-</span>
                            <div className="relative flex-1">
                              <input 
                                type="time" 
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={parseTimeRange(editForm.waktuKonsultasi).end}
                                onChange={(e) => {
                                  const { start } = parseTimeRange(editForm.waktuKonsultasi);
                                  setEditForm({...editForm, waktuKonsultasi: formatTimeRange(start, e.target.value)});
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1 font-semibold">Konsultan</label>
                          <div className="relative">
                            <SearchableDropdown 
                              value={editForm.konsultan}
                              options={konsultanOptions}
                              placeholder="Cari Konsultan..."
                              onChange={(val) => setEditForm({...editForm, konsultan: val})}
                            />
                            <div className="mt-1 border-b border-slate-200"></div>
                          </div>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-700 text-[10px] rounded-lg border border-blue-100 leading-relaxed">
                          Status akan berubah menjadi <strong>Terkonfirmasi</strong> jika semua field di atas terisi.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <DetailItem icon={<Calendar />} label="Tanggal Konsultasi" value={formatDateDisplay(selectedItem.tanggalKonsultasi)} />
                        <DetailItem icon={<Clock />} label="Waktu Konsultasi" value={selectedItem.waktuKonsultasi} />
                        <DetailItem icon={<User />} label="Konsultan" value={selectedItem.konsultan} />
                      </div>
                    )}
                    <DetailItem icon={<MapPin />} label="Tempat" value={selectedItem.tempatKonsultasi} />
                  </div>
                </div>
                <div className="md:col-span-2 border-t border-slate-100 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Orang Tua</label>
                      <div className="mt-3 space-y-4">
                        <DetailItem icon={<User />} label="Nama Wali" value={selectedItem.namaOrangTua} />
                        <DetailItem icon={<Phone />} label="WhatsApp Ortu" value={selectedItem.noWhatsappOrtu} isPhone />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lainnya</label>
                      <div className="mt-3 space-y-4">
                        <DetailItem icon={<ArrowRight />} label="Sekolah Target" value={selectedItem.sekolahTarget} />
                        <DetailItem icon={<Filter />} label="Jalur Masuk" value={selectedItem.jalurMasuk} />
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                            <Clock className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs text-slate-400">Status Terkini</div>
                            <span className={cn(
                              "mt-1 inline-block px-2.5 py-1 rounded-full text-xs font-semibold border",
                              getStatusColor(isEditing ? 
                                (editForm.tanggalKonsultasi && editForm.waktuKonsultasi && editForm.konsultan ? 'Terkonfirmasi' : 'Belum Dikonfirmasi') 
                                : selectedItem.status
                              )
                            )}>
                              {isEditing ? 
                                (editForm.tanggalKonsultasi && editForm.waktuKonsultasi && editForm.konsultan ? 'Terkonfirmasi' : 'Belum Dikonfirmasi') 
                                : selectedItem.status
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => {setSelectedItem(null); setIsEditing(false);}}
                className="px-6 py-2 bg-white border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              {isEditing ? (
                <button 
                  onClick={handleSave}
                  className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Simpan Perubahan
                </button>
              ) : (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Ubah Data
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={cn(
            "px-5 py-3 rounded-xl shadow-2xl border flex items-center gap-3 max-w-sm",
            toast.type === 'success' && "bg-white border-green-200 text-green-800",
            toast.type === 'error' && "bg-white border-red-200 text-red-800",
            toast.type === 'info' && "bg-white border-amber-200 text-amber-800"
          )}>
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />}
            {toast.type === 'error' && <X className="w-5 h-5 text-red-600 shrink-0" />}
            {toast.type === 'info' && <Users className="w-5 h-5 text-amber-600 shrink-0" />}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-slate-400 text-xs">
        <p>© 2024 Dashboard Monitoring Siswa. Terintegrasi dengan databse.</p>
      </footer>
    </div>
  );
}

function SearchableDropdown({ 
  value, 
  onChange, 
  options, 
  placeholder 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: string[]; 
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 200) {
        setDropdownPosition('top');
      } else {
        setDropdownPosition('bottom');
      }
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative flex items-center group/dropdown">
        <input
          type="text"
          className="w-full pl-2 pr-8 py-1.5 text-sm border border-slate-200 hover:border-indigo-400 focus:border-indigo-500 bg-white rounded-lg transition-all outline-none shadow-sm"
          value={isOpen ? search : value}
          placeholder={placeholder}
          onFocus={() => {
            setIsOpen(true);
            setSearch('');
          }}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="absolute right-2 text-slate-400 pointer-events-none">
          <ChevronRight className={cn("w-4 h-4 transition-transform", isOpen ? "rotate-90" : "")} />
        </div>
      </div>
      
      {isOpen && (
        <div 
          className={cn(
            "absolute z-[9999] left-0 right-0 min-w-[220px] bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in zoom-in duration-150",
            dropdownPosition === 'bottom' ? "mt-2 top-full" : "mb-2 bottom-full"
          )}
        >
          <div className="p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, i) => (
                <button
                  key={i}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors flex items-center justify-between group"
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  <span className="font-medium">{opt}</span>
                  {value === opt && <CheckCircle className="w-4 h-4 text-indigo-500" />}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400 italic text-center">
                Nama tidak ditemukan
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ icon, label, value, isPhone = false }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  isPhone?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="p-2 bg-slate-100 rounded-lg text-slate-500 shrink-0 h-fit">
        <div className="w-5 h-5 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        {isPhone && value ? (
          <a 
            href={`https://wa.me/${value.replace(/\D/g, '')}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            {value} <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <div className="text-sm font-semibold text-slate-700 font-medium break-words">{value || '-'}</div>
        )}
      </div>
    </div>
  );
}


function StatCard({ title, value, icon, color, isText = false }: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  color: 'indigo' | 'emerald' | 'amber' | 'violet';
  isText?: boolean;
}) {
  const themes = {
    indigo: "from-indigo-500 to-indigo-600 shadow-indigo-200 text-white",
    emerald: "from-emerald-500 to-emerald-600 shadow-emerald-200 text-white",
    amber: "from-amber-400 to-amber-500 shadow-amber-200 text-white",
    violet: "from-violet-500 to-violet-600 shadow-violet-200 text-white",
  };

  return (
    <div className={cn(
      "bg-gradient-to-br p-8 rounded-[2.5rem] shadow-xl transition-all hover:scale-[1.02] duration-300 group",
      themes[color]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-2">{title}</h3>
          <p className={cn(
            "font-black tracking-tight leading-none",
            isText ? "text-2xl" : "text-5xl"
          )}>
            {value}
          </p>
        </div>
        <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl shadow-inner group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div className="mt-6 flex items-center gap-2">
        <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/60 w-[65%] rounded-full"></div>
        </div>
        <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">Active</span>
      </div>
    </div>
  );
}

export default App;
