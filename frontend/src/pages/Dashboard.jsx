import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { Activity, Clock, Upload, Bell, CheckCircle2, AlertTriangle, LogOut } from 'lucide-react';

export default function Dashboard() {
  const { user, token, logout } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [queueToken, setQueueToken] = useState(null);
  const [file, setFile] = useState(null);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    if (!token) return;

    const fetchActiveQueue = async () => {
      try {
        const { data } = await axios.get('http://localhost:8000/api/queue/my-active', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setQueueToken(data);
      } catch (e) {
        // No active queue found
      }
    };
    fetchActiveQueue();

    const newSocket = io('http://localhost:8000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
       newSocket.emit('join', user.id);
    });

    newSocket.on('queueUpdate', () => {
      if (queueToken) fetchQueueStatus(queueToken._id);
    });

    newSocket.on('notification', (data) => {
      setNotification(data.message);
    });

    return () => newSocket.close();
  }, [token, user, queueToken?._id]);

  const fetchQueueStatus = async (tokenId) => {
    try {
      const { data } = await axios.get(`http://localhost:8000/api/queue/status/${tokenId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQueueToken(data);
    } catch(err) {
      console.error(err);
    }
  };

  const analyzeSymptoms = async () => {
    if (!symptoms.trim()) return alert('Please enter your symptoms first!');
    try {
      const { data } = await axios.post('http://localhost:5000/predict', { symptoms });
      setPrediction(data);
    } catch (err) {
      console.error(err);
      alert('Failed to connect to AI server. Please make sure Python Flask is running! Error: ' + err.message);
    }
  };

  const joinQueue = async () => {
    try {
      const { data } = await axios.post('http://localhost:8000/api/queue/join', {
        department: prediction.department,
        urgency: prediction.urgency,
        issues: symptoms,
        isEmergency: prediction.urgency === 'Emergency'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQueueToken(data);
    } catch (err) {
      alert('Failed to join queue');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('document', file);
    try {
      await axios.post('http://localhost:8000/api/upload', formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      alert('File uploaded successfully!');
      setFile(null);
    } catch (err) {
      alert('Upload failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 pb-20">
      <nav className="max-w-6xl mx-auto flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm mb-8 border border-slate-100">
        <div className="flex items-center space-x-2">
          <Activity className="w-8 h-8 text-indigo-600" />
          <h1 className="text-xl font-bold text-slate-800">Q-Less Dashboard</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-slate-600 font-medium hidden sm:block">Hello, {user?.name}</span>
          <button onClick={logout} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {notification && (
        <div className="max-w-6xl mx-auto mb-6 p-4 bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl shadow-lg flex items-center shadow-red-200 animate-pulse">
           <AlertTriangle className="w-6 h-6 text-white mr-3" />
           <p className="text-white font-bold">{notification}</p>
           <button onClick={() => setNotification('')} className="ml-auto text-white/80 hover:text-white">✕</button>
        </div>
      )}

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: AI Symptom Analyzer */}
        <div className="lg:col-span-2 space-y-8">
          {!queueToken || queueToken.status === 'cancelled' || queueToken.status === 'completed' ? (
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10"></div>
               <h2 className="text-2xl font-bold mb-2 text-slate-800">How are you feeling today?</h2>
               <p className="text-slate-500 mb-6">Describe your symptoms to get directed to the right department.</p>
               
               <textarea 
                 value={symptoms}
                 onChange={(e) => setSymptoms(e.target.value)}
                 className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-32 mb-4 transition-all"
                 placeholder="e.g., I have a severe headache and fever..."
               ></textarea>
               
               <button 
                 onClick={analyzeSymptoms}
                 className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center"
               >
                 <Activity className="w-5 h-5 mr-2" />
                 Analyze Symptoms with AI
               </button>

               {prediction && (
                 <div className="mt-6 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="font-semibold text-slate-800 mb-4">AI Recommendation:</h3>
                    <div className="flex flex-wrap gap-4 mb-6">
                       <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-100 flex items-center">
                          <Activity className="w-4 h-4 text-indigo-500 mr-2" />
                          <span className="text-slate-700 font-medium">{prediction.department}</span>
                       </div>
                       <div className={`px-4 py-2 rounded-lg shadow-sm border font-medium flex items-center ${
                         prediction.urgency === 'Emergency' ? 'bg-red-50 text-red-700 border-red-200' :
                         prediction.urgency === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                         'bg-green-50 text-green-700 border-green-200'
                       }`}>
                          {prediction.urgency} Urgency
                       </div>
                    </div>
                    <button 
                      onClick={joinQueue}
                      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition transform hover:-translate-y-0.5"
                    >
                      Join Virtual Queue
                    </button>
                 </div>
               )}
            </div>
          ) : (
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 animate-in fade-in zoom-in-95 duration-500">
               <h2 className="text-2xl font-bold mb-6 text-slate-800">Your Current Status</h2>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-gradient-to-br from-indigo-500 to-cyan-400 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
                    <p className="text-indigo-100 font-medium mb-1 relative z-10">Position in Queue</p>
                    <div className="text-6xl font-extrabold relative z-10">{queueToken.position || (queueToken.status === 'serving' ? "Now Serving" : "0")}</div>
                    <p className="mt-4 text-sm font-medium bg-white/20 inline-block px-3 py-1 rounded-lg relative z-10">
                      {queueToken.department}
                    </p>
                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                 </div>
                 
                 <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner flex flex-col justify-center items-center text-center">
                    <Clock className="w-10 h-10 text-orange-500 mb-3" />
                    <p className="text-slate-500 font-medium">Estimated Wait Time</p>
                    <div className="text-4xl font-bold text-slate-800 mt-1">
                      {queueToken.estimatedWaitTime} <span className="text-lg text-slate-500 font-normal">mins</span>
                    </div>
                 </div>
               </div>

               {queueToken.status === 'serving' && (
                  <div className="mt-6 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center shadow-sm">
                    <CheckCircle2 className="w-6 h-6 mr-3" />
                    <strong>Please head to the {queueToken.department} counter. It is your turn!</strong>
                  </div>
               )}
            </div>
          )}
        </div>

        {/* Right Column: Uploads / Extras */}
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <Upload className="w-5 h-5 text-indigo-500 mr-2" />
              Upload Documents
            </h3>
            <p className="text-sm text-slate-500 mb-4">Upload past medical records or prescriptions.</p>
            
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 hover:border-indigo-300 transition cursor-pointer group">
              <input 
                type="file" 
                id="file-upload" 
                className="hidden" 
                onChange={(e) => setFile(e.target.files[0])} 
              />
              <label htmlFor="file-upload" className="cursor-pointer w-full h-full block">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-indigo-500" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    {file ? file.name : "Click to select a file"}
                  </span>
                </div>
              </label>
            </div>
            {file && (
              <button 
                onClick={handleUpload}
                className="w-full mt-4 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 transition shadow-md"
              >
                Confirm Upload
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
