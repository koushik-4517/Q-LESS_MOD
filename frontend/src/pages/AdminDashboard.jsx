import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { Activity, Users, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { io } from 'socket.io-client';

export default function AdminDashboard() {
  const { token, logout } = useContext(AuthContext);
  const [tokens, setTokens] = useState([]);
  const [stats, setStats] = useState([]);
  const [socket, setSocket] = useState(null);

  const handleReassign = async (tokenId, newDepartment) => {
    if(!newDepartment) return;
    try {
      await axios.post(`http://localhost:8000/api/queue/reassign/${tokenId}`, { department: newDepartment }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchQueues();
    } catch(e) {
      alert('Failed to reassign');
    }
  };

  const fetchQueues = async () => {
    try {
      const { data } = await axios.get('http://localhost:8000/api/queue/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTokens(data);
      
      const deptCounts = {};
      data.forEach(t => {
        if (t.status === 'waiting') {
           deptCounts[t.department] = (deptCounts[t.department] || 0) + 1;
        }
      });
      const chartData = Object.keys(deptCounts).map(key => ({
        name: key,
        Waiting: deptCounts[key]
      }));
      setStats(chartData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchQueues();
    
    const newSocket = io('http://localhost:8000');
    setSocket(newSocket);

    newSocket.on('queueUpdate', () => {
      fetchQueues();
    });

    return () => newSocket.close();
  }, [token]);

  const serveNext = async (department) => {
    try {
      await axios.post(`http://localhost:8000/api/queue/serve/${department}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchQueues();
    } catch (err) {
      alert(err.response?.data?.message || 'Error serving next');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-20">
      <nav className="max-w-7xl mx-auto flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm mb-8 border border-slate-100">
        <div className="flex items-center space-x-2">
          <Activity className="w-8 h-8 text-indigo-600" />
          <h1 className="text-xl font-bold text-slate-800">Q-Less Admin</h1>
        </div>
        <button onClick={logout} className="text-slate-600 font-medium hover:text-indigo-600 transition">Logout</button>
      </nav>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Analytics Section */}
        <div className="lg:col-span-1 space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <Users className="w-5 h-5 text-indigo-500 mr-2" />
              Queue Overview
            </h2>
            <div className="h-64">
              {stats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats}>
                    <XAxis dataKey="name" tick={{fontSize: 12}} />
                    <YAxis allowDecimals={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="Waiting" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                 <div className="h-full flex items-center justify-center text-slate-400">No active queues</div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-cyan-400 p-6 rounded-3xl shadow-lg shadow-indigo-200 text-white relative overflow-hidden">
             <div className="relative z-10">
               <h3 className="font-bold mb-2 text-indigo-100">Total Waiting</h3>
               <div className="text-6xl font-extrabold">{tokens.filter(t => t.status === 'waiting').length}</div>
             </div>
             <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          </div>
        </div>

        {/* Live Queue Tables */}
        <div className="lg:col-span-2 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
           {tokens.filter(t => t.status === 'serving').length > 0 && (
             <div className="bg-green-50/50 p-6 md:p-8 rounded-3xl shadow-sm border border-green-200">
                <h2 className="text-xl font-bold text-green-800 mb-6 flex items-center">
                  <CheckCircle2 className="w-6 h-6 mr-2 text-green-600" /> Currently Serving Now
                </h2>
                <div className="space-y-4">
                   {tokens.filter(t => t.status === 'serving').map(t => (
                      <div key={t._id} className="p-4 rounded-2xl bg-white border border-green-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                         <div>
                           <p className="font-bold text-slate-800 text-lg">{t.userId?.name || 'Unknown Patient'} <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded ml-2 font-bold">{t.department}</span></p>
                           <p className="text-sm font-medium text-slate-500 mt-1">{t.issues}</p>
                         </div>
                         <span className="px-4 py-2 bg-green-100 text-green-800 font-bold rounded-xl text-sm flex items-center">
                           <span className="animate-pulse mr-2 w-2 h-2 rounded-full bg-green-600"></span> Session in Progress
                         </span>
                      </div>
                   ))}
                </div>
             </div>
           )}

           <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-bold text-slate-800">Live Queues</h2>
             </div>

             {['Cardiology', 'Orthopedics', 'General Medicine', 'Ophthalmology', 'Gastroenterology', 'Emergency', 'Consultation'].map(dept => {
               const deptTokens = tokens.filter(t => t.department === dept && t.status === 'waiting').sort((a,b) => b.isEmergency - a.isEmergency);
               
               if (deptTokens.length === 0) return null;
               
               return (
                 <div key={dept} className="mb-10 last:mb-0">
                   <div className="flex justify-between items-center border-b-2 border-slate-50 pb-3 mb-4">
                     <h3 className="text-lg font-extrabold text-slate-700">{dept}</h3>
                     <button 
                       onClick={() => serveNext(dept)}
                       className="text-sm px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 hover:scale-105 transition-all flex items-center"
                     >
                       Serve Next <ArrowRight className="w-4 h-4 ml-1" />
                     </button>
                   </div>
                   <div className="space-y-3">
                     {deptTokens.map((t, idx) => (
                       <div key={t._id} className={`p-4 rounded-2xl border flex justify-between items-center transition-all ${t.isEmergency || t.urgency === 'High' ? 'bg-red-50/50 border-red-100' : 'bg-slate-50/50 border-slate-100 hover:border-indigo-200'}`}>
                         <div className="flex items-center space-x-4">
                           <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${t.urgency === 'Emergency' ? 'bg-red-500 shadow-red-200' : 'bg-indigo-500 shadow-indigo-200'}`}>
                             #{idx + 1}
                           </div>
                           <div>
                             <p className="font-bold text-slate-800">{t.userId?.name || 'Unknown Patient'}</p>
                             <p className="text-sm font-medium text-slate-500">{t.issues}</p>
                           </div>
                         </div>
                         <div className="text-right flex flex-col items-end">
                           <select 
                              onChange={(e) => handleReassign(t._id, e.target.value)} 
                              defaultValue={dept}
                              className="mb-2 text-xs font-bold border border-slate-200 rounded px-2 py-1 text-slate-600 bg-white shadow-sm outline-none cursor-pointer hover:border-indigo-300 transition"
                           >
                              <option value="Cardiology">Cardiology</option>
                              <option value="Orthopedics">Orthopedics</option>
                              <option value="General Medicine">General Medicine</option>
                              <option value="Ophthalmology">Ophthalmology</option>
                              <option value="Gastroenterology">Gastroenterology</option>
                              <option value="Emergency">Emergency</option>
                              <option value="Consultation">Consultation</option>
                           </select>
                           <span className={`text-xs px-3 py-1.5 rounded-lg font-extrabold ${t.urgency === 'Emergency' ? 'bg-red-200 text-red-800' : t.urgency === 'High' ? 'bg-orange-200 text-orange-800' : 'bg-slate-200 text-slate-700'}`}>
                             {t.urgency}
                           </span>
                           <p className="text-sm font-bold text-slate-500 mt-2 flex justify-end items-center"><Clock className="w-4 h-4 mr-1 text-slate-400"/> {idx * 15} mins expected</p>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               );
             })}
             
             {tokens.filter(t => t.status === 'waiting').length === 0 && (
                 <div className="text-center py-12 text-slate-400 font-medium">
                     No patients are currently waiting in any department.
                 </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
