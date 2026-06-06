import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { Activity, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { io } from 'socket.io-client';

export default function DoctorDashboard() {
  const { token, user, logout } = useContext(AuthContext);
  const [tokens, setTokens] = useState([]);
  const [stats, setStats] = useState({ totalWaiting: 0, avgWaitTime: 0 });

  const fetchQueues = async () => {
    try {
      const { data } = await axios.get('http://localhost:8000/api/queue/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter for this doctor's specialization
      const myTokens = data.filter(t => t.department === user.specialization);
      setTokens(myTokens);
      
      const waiting = myTokens.filter(t => t.status === 'waiting');
      const avg = waiting.length > 0 ? waiting.reduce((acc, t) => acc + (t.estimatedWaitTime || 0), 0) / waiting.length : 0;
      setStats({ totalWaiting: waiting.length, avgWaitTime: Math.round(avg) });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchQueues();
    const newSocket = io('http://localhost:8000');
    newSocket.on('queueUpdate', () => { fetchQueues(); });
    return () => newSocket.close();
  }, [token]);

  const handleServeNext = async () => {
    try {
      await axios.post(`http://localhost:8000/api/queue/serve/${user.specialization}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchQueues();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to serve next');
    }
  };

  const myWaitingTokens = tokens.filter(t => t.status === 'waiting').sort((a,b) => b.isEmergency - a.isEmergency);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Q-Less Doctor Dashboard</h1>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <span className="text-slate-800 font-bold block">Dr. {user?.name}</span>
              <span className="text-indigo-600 font-medium text-sm">{user?.specialization}</span>
            </div>
            <button onClick={logout} className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 transition">
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8 animate-in fade-in duration-500">
           {tokens.filter(t => t.status === 'serving').length > 0 && (
             <div className="bg-green-50/50 p-6 md:p-8 rounded-3xl shadow-sm border border-green-200">
                <h2 className="text-xl font-bold text-green-800 mb-6 flex items-center">
                  <CheckCircle2 className="w-6 h-6 mr-2 text-green-600" /> Currently Serving Now
                </h2>
                <div className="space-y-4">
                   {tokens.filter(t => t.status === 'serving').map(t => (
                      <div key={t._id} className="p-4 rounded-2xl bg-white border border-green-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                         <div>
                           <p className="font-bold text-slate-800 text-lg">{t.userId?.name || 'Unknown Patient'} <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded ml-2 font-bold">Token: {t._id.toString().slice(-4)}</span></p>
                           <p className="text-sm font-medium text-slate-500 mt-1">{t.issues}</p>
                         </div>
                         <button onClick={async () => {
                              try {
                                await axios.post(`http://localhost:8000/api/queue/complete/${t._id}`, {}, { headers: { Authorization: `Bearer ${token}` }});
                                fetchQueues();
                              } catch(e) { alert('Failed to complete session'); }
                           }} className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition">Proceed</button>
                      </div>
                   ))}
                </div>
             </div>
           )}

           <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">My Patient Queue</h2>
                <span className="text-indigo-600 text-sm font-bold bg-indigo-50 px-3 py-1 rounded-lg">Awaiting Admin Assignment</span>
             </div>
             
             {myWaitingTokens.length === 0 ? (
               <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50"><p className="text-slate-500 font-medium">No patients currently waiting.</p></div>
             ) : (
               <div className="space-y-3">
                 {myWaitingTokens.map((t, idx) => (
                   <div key={t._id} className={`p-4 rounded-xl border ${t.isEmergency ? 'border-red-200 bg-red-50/50' : 'border-slate-100 bg-slate-50'} flex flex-col sm:flex-row justify-between gap-4`}>
                      <div className="flex items-center space-x-4">
                         <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">#{idx + 1}</div>
                         <div>
                            <p className="font-bold text-slate-800">{t.userId?.name || 'Unknown'} {t.isEmergency && <span className="text-xs ml-2 bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">Emergency</span>}</p>
                            <p className="text-sm text-slate-500">{t.issues}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-sm font-medium text-slate-500">Token Number</p>
                         <p className="font-bold text-slate-800">{t._id.toString().slice(-4)}</p>
                      </div>
                   </div>
                 ))}
               </div>
             )}
           </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg">
            <h3 className="text-indigo-200 font-medium mb-1">Total Waiting Patients</h3>
            <p className="text-5xl font-black mb-4">{stats.totalWaiting}</p>
            <div className="pt-4 border-t border-indigo-500/50 flex flex-col">
              <span className="text-indigo-200 font-medium text-sm">Estimated Average Wait</span>
              <div className="flex items-center mt-1 space-x-2"><Clock className="w-4 h-4 text-indigo-200"/><span className="font-bold text-lg">{stats.avgWaitTime} mins</span></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
