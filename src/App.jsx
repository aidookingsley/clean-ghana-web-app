import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, query, onSnapshot, 
  doc, updateDoc, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  MapPin, Camera, Trash2, Recycle, LogOut, 
  CheckCircle, Clock, AlertTriangle, Menu, X,
  Navigation, User, Building2, Truck, Image as ImageIcon
} from 'lucide-react';


/* --- FIREBASE CONFIGURATION & SETUP --- 
  This section handles the connection to the backend database.
*/
let firebaseConfig;

// Hardcoded config for deployment to Netlify without env vars. It can be put into .env files too but it's safe to leave it here for this project

const hardcodedConfig = {
  apiKey: "AIzaSyBrD71MIMtC9_vJ9SC45xB2KUKk3p3leFw",
  authDomain: "clean-ghana-app.firebaseapp.com",
  projectId: "clean-ghana-app",
  storageBucket: "clean-ghana-app.firebasestorage.app",
  messagingSenderId: "805375125732",
  appId: "1:805375125732:web:3a51de0177123006e764f1",
  measurementId: "G-SLBBM6NYHB"
};

firebaseConfig = hardcodedConfig;

// The try-catch allows us to use a sandbox environment where the config is injected at runtime
try {
  if (typeof globalThis.__firebase_config !== 'undefined' && globalThis.__firebase_config) {
    firebaseConfig = typeof globalThis.__firebase_config === 'string' ? JSON.parse(globalThis.__firebase_config) : globalThis.__firebase_config;
  }
} catch (err) {
  // If the injected config is invalid, warn and fallback
  console.warn('Failed to parse injected __firebase_config:', err);
}

// Fallback to environment variables (REACT_APP_FIREBASE_*) or a minimal default for local/demo runs
if (!firebaseConfig) {
  firebaseConfig = {
    apiKey: import.meta.env.REACT_APP_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.REACT_APP_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.REACT_APP_FIREBASE_APP_ID || 'clean-ghana-app'
  };
}

// Initialize firebase app
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper to get App ID for paths
const appId = (typeof globalThis.__app_id !== 'undefined' ? globalThis.__app_id : (firebaseConfig.appId || 'clean-ghana-app'));

/* --- COMPONENTS --- 
*/

// --- 1. LOGIN SCREEN ---
const LoginScreen = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-green-600 p-4 rounded-full">
            <Recycle className="w-10 h-10 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">CleanGhana</h1>
        <p className="text-center text-gray-500 mb-8">Smart Waste Reporting & Recycling</p>
        
        <div className="space-y-4">
          <button 
            onClick={() => onLogin('citizen')}
            className="w-full flex items-center p-4 border-2 border-green-100 rounded-xl hover:bg-green-50 hover:border-green-500 transition-all group"
          >
            <div className="bg-green-100 p-3 rounded-full mr-4 group-hover:bg-green-200">
              <User className="text-green-700" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-800">Citizen</h3>
              <p className="text-sm text-gray-500">Report waste & request pickups</p>
            </div>
          </button>

          <button 
            onClick={() => onLogin('authority')}
            className="w-full flex items-center p-4 border-2 border-blue-100 rounded-xl hover:bg-blue-50 hover:border-blue-500 transition-all group"
          >
            <div className="bg-blue-100 p-3 rounded-full mr-4 group-hover:bg-blue-200">
              <Building2 className="text-blue-700" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-800">Sanitation Authority</h3>
              <p className="text-sm text-gray-500">Manage reports & clearance</p>
            </div>
          </button>

          <button 
            onClick={() => onLogin('recycler')}
            className="w-full flex items-center p-4 border-2 border-orange-100 rounded-xl hover:bg-orange-50 hover:border-orange-500 transition-all group"
          >
            <div className="bg-orange-100 p-3 rounded-full mr-4 group-hover:bg-orange-200">
              <Truck className="text-orange-700" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-800">Recycling Company</h3>
              <p className="text-sm text-gray-500">View ready-to-collect items</p>
            </div>
          </button>
        </div>
      </div>
      <p className="mt-8 text-gray-400 text-sm">Final Year Project Mockup</p>
    </div>
  );
};

// --- 2. CITIZEN DASHBOARD ---
const CitizenDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('report');
  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState('idle'); // idle, locating, success, error
  const [location, setLocation] = useState(null);
  
  // Form States
  const [description, setDescription] = useState('');
  const [materialType, setMaterialType] = useState('Plastic Bottles');
  const [qty, setQty] = useState('');
  
  // Camera/Image States
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Get GPS Location
  const handleGetLocation = () => {
    setLocationStatus('locating');
    
    if (!navigator.geolocation) {
      // Use custom alert instead of window.alert
      console.log("Geolocation is not supported by your browser");
      setLocation({ lat: 5.6037, lng: -0.1870, address: "Legon, Accra (Default Fallback)" });
      setLocationStatus('success'); 
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        try {
          // Attempt reverse geocoding using OpenStreetMap (Free, no API key needed for demo)
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await response.json();
          
          // Construct a shorter address from the full response
          const formattedAddress = data.display_name 
            ? data.display_name.split(',').slice(0, 3).join(',') // Take first 3 parts (e.g., Street, City, Region)
            : `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;

          setLocation({
            lat,
            lng,
            address: formattedAddress
          });
          setLocationStatus('success');
        } catch (error) {
          console.error("Geocoding failed, but GPS coordinates retrieved:", error);
          // Fallback if geocoding fails but GPS worked
          setLocation({
            lat,
            lng,
            address: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)} (Geocoding Failed)`
          });
          setLocationStatus('success');
        }
      },
      (error) => {
        // This block runs if the user denies permission OR the browser cannot find a location (common on desktop).
        console.error("Location retrieval failed (Code: " + error.code + "):", error.message || error);
        
        // Fallback for demo if permission denied or location fails
        setLocation({ 
          lat: 5.6037, 
          lng: -0.1870, 
          address: "Legon, Accra (Demo Location Fallback)" 
        }); 
        
        // Set status to success so the UI updates and shows the fallback location
        setLocationStatus('success'); 
        // Display a message to the user that location access failed
        console.log("Location access failed or denied. Using demo location for testing.");
      }
    );
  };

  // Handle Camera Click
  const handleCameraClick = () => {
    fileInputRef.current.click();
  };

  // Handle File Selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Waste Report
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    // Replaced alert with console.log for better UX in embedded environments
    if (!description || !location) return console.log("Please add description and location");
    
    setLoading(true);
    try {
      // Note: In a real app, you would upload the 'imagePreview' file to Firebase Storage here.
      // For this demo, we are using a placeholder or the base64 string if small enough, 
      // but to keep Firestore clean we'll use a placeholder URL if no image is actually uploaded.
      const finalImage = imagePreview || 'https://placehold.co/600x400/e2e8f0/1e293b?text=Waste+Image';

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'reports'), {
        type: 'waste_report',
        description,
        wasteType: materialType,
        location,
        status: 'pending',
        reporterId: user.uid,
        timestamp: serverTimestamp(),
        imageUrl: finalImage 
      });
      // Replaced alert with console.log for better UX
      console.log("Report submitted successfully!");
      setDescription('');
      setLocation(null);
      setLocationStatus('idle');
      setImagePreview(null);
    } catch (error) {
      console.error("Error adding report: ", error);
    }
    setLoading(false);
  };

  // Submit Recycling Request
  const handleSubmitRecycle = async (e) => {
    e.preventDefault();
    // Replaced alert with console.log for better UX in embedded environments
    if (!qty || !location) return console.log("Please add quantity and location");

    setLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'reports'), {
        type: 'recycling_request',
        materialType,
        quantity: qty,
        location,
        status: 'ready',
        reporterId: user.uid,
        timestamp: serverTimestamp()
      });
      // Replaced alert with console.log for better UX
      console.log("Pickup request sent to recyclers!");
      setQty('');
      setLocation(null);
      setLocationStatus('idle');
    } catch (error) {
      console.error("Error adding request: ", error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-green-600 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Recycle className="h-6 w-6" /> CleanGhana
          </h2>
          <button onClick={onLogout} className="text-sm bg-green-700 px-3 py-1 rounded-lg">
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 mt-4">
        {/* Navigation Tabs */}
        <div className="flex bg-white rounded-xl shadow-sm p-1 mb-6">
          <button 
            onClick={() => setActiveTab('report')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'report' ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}
          >
            Report Waste
          </button>
          <button 
            onClick={() => setActiveTab('recycle')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'recycle' ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}
          >
            Recycle
          </button>
        </div>

        {/* Content Area */}
        {activeTab === 'report' ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-6">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="text-red-500 h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Report Illegal Dumping</h3>
              <p className="text-sm text-gray-500">Help keep your community clean</p>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              {/* Camera Input Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Photo</label>
                
                {/* Hidden File Input */}
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  className="hidden" 
                />

                <div 
                  onClick={handleCameraClick}
                  className={`border-2 border-dashed rounded-xl p-0 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 cursor-pointer transition-colors overflow-hidden relative ${imagePreview ? 'border-green-500 h-64' : 'border-gray-300 h-40'}`}
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white font-bold flex items-center gap-2"><Camera className="h-5 w-5"/> Change Photo</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center p-8">
                      <Camera className="h-8 w-8 mb-2" />
                      <span className="text-xs">Tap to take photo</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Overflowing bin at market circle..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  rows="3"
                />
              </div>

              <div>
                 <button 
                  type="button"
                  onClick={handleGetLocation}
                  className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors ${locationStatus === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}
                 >
                   <MapPin className="h-4 w-4" />
                   {locationStatus === 'idle' && "Get GPS Location"}
                   {locationStatus === 'locating' && "Locating..."}
                   {locationStatus === 'success' && location && location.address}
                   {locationStatus === 'error' && "Retry Location"}
                 </button>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-6">
              <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                <Recycle className="text-green-600 h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Recycling Pickup</h3>
              <p className="text-sm text-gray-500">Earn points for sustainable habits</p>
            </div>

            <form onSubmit={handleSubmitRecycle} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
                <select 
                  value={materialType}
                  onChange={(e) => setMaterialType(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option>Plastic Bottles (PET)</option>
                  <option>Water Sachets</option>
                  <option>Cardboard / Paper</option>
                  <option>Aluminum Cans</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Quantity</label>
                <input 
                  type="text"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="e.g., 2 large bags"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div>
                 <button 
                  type="button"
                  onClick={handleGetLocation}
                  className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium transition-colors ${locationStatus === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}
                 >
                   <MapPin className="h-4 w-4" />
                   {locationStatus === 'idle' && "Get Pickup Location"}
                   {locationStatus === 'locating' && "Locating..."}
                   {locationStatus === 'success' && location && location.address}
                   {locationStatus === 'error' && "Retry Location"}
                 </button>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Requesting...' : 'Request Pickup'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

// --- 3. AUTHORITY DASHBOARD (Admin) ---
// View for Sanitation Officers to manage waste reports
const AuthorityDashboard = ({ onLogout }) => {
  const [reports, setReports] = useState([]);
  
  useEffect(() => {
    // Only fetch type 'waste_report'
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'reports'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => item.type === 'waste_report'); // Client-side filtering for simplicity
      setReports(data);
    });
    return () => unsubscribe();
  }, []);

  const markResolved = async (id) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reports', id), {
      status: 'resolved'
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-blue-800 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Authority Portal
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm bg-blue-700 px-3 py-1 rounded-full hidden md:inline-block">District: Ayawaso West</span>
            <button onClick={onLogout} className="text-sm bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stats Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm col-span-1 md:col-span-2 flex justify-between items-center">
            <div>
              <h3 className="text-gray-500 font-medium">Pending Issues</h3>
              <p className="text-3xl font-bold text-gray-800">{reports.filter(r => r.status === 'pending').length}</p>
            </div>
            <div>
              <h3 className="text-gray-500 font-medium">Resolved Today</h3>
              <p className="text-3xl font-bold text-green-600">{reports.filter(r => r.status === 'resolved').length}</p>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-sm text-gray-400">System Status</p>
              <p className="text-green-500 font-medium flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Online</p>
            </div>
          </div>

          {/* List of Reports */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-bold text-gray-700 mb-4">Incoming Reports</h3>
            {reports.length === 0 ? (
               <div className="text-center py-12 bg-white rounded-xl text-gray-400">No active reports found. Good job!</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reports.map((report) => (
                  <div key={report.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col ${report.status === 'resolved' ? 'opacity-60 grayscale' : ''}`}>
                    <div className="h-40 bg-gray-200 relative">
                      <img src={report.imageUrl} alt="Waste" className="w-full h-full object-cover" />
                      <div className={`absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-bold uppercase ${report.status === 'pending' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                        {report.status}
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start gap-2 mb-2 text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{report.location?.address || "Unknown Location"}</span>
                      </div>
                      <p className="text-gray-800 font-medium mb-4 line-clamp-2 flex-1">"{report.description}"</p>
                      
                      {report.status === 'pending' ? (
                        <button 
                          onClick={() => markResolved(report.id)}
                          className="mt-auto w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" /> Mark Resolved
                        </button>
                      ) : (
                        <div className="mt-auto w-full bg-green-50 text-green-700 py-2 rounded-lg text-center text-sm font-medium border border-green-100">
                          Resolved
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 4. RECYCLER DASHBOARD ---
// View for Recycling Companies
const RecyclerDashboard = ({ onLogout }) => {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
     // Only fetch type 'recycling_request'
     const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'reports'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => item.type === 'recycling_request'); 
      setRequests(data);
    });
    return () => unsubscribe();
  }, []);

  const markCollected = async (id) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reports', id), {
      status: 'collected'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-orange-600 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" /> Jekora Ventures Portal
          </h2>
          <button onClick={onLogout} className="text-sm bg-orange-700 hover:bg-orange-500 px-3 py-1 rounded-lg">
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
        <h3 className="text-lg font-bold text-gray-700 mb-6 flex items-center gap-2">
          <Recycle className="h-5 w-5 text-green-600" />
          Ready for Collection
        </h3>

        {requests.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <Recycle className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No pickup requests available yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((req) => (
              <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-full ${req.status === 'collected' ? 'bg-gray-100' : 'bg-green-100'}`}>
                    <Recycle className={`h-6 w-6 ${req.status === 'collected' ? 'text-gray-400' : 'text-green-600'}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{req.materialType}</h4>
                    <p className="text-sm text-gray-500">{req.quantity} • {req.location?.address}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Reported: {req.timestamp ? new Date(req.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}
                    </p>
                  </div>
                </div>

                {req.status === 'ready' ? (
                  <button 
                    onClick={() => markCollected(req.id)}
                    className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors shadow-sm whitespace-nowrap"
                  >
                    Confirm Pickup
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-green-600 font-medium bg-green-50 px-4 py-2 rounded-lg border border-green-100 whitespace-nowrap">
                    <CheckCircle className="h-4 w-4" /> Collected
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
// Handles routing and global state
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'citizen', 'authority', 'recycler'
  const [loading, setLoading] = useState(true);

  // Handle Authentication
  useEffect(() => {
    const initAuth = async () => {
      if (typeof globalThis.__initial_auth_token !== 'undefined' && globalThis.__initial_auth_token) {
        await signInWithCustomToken(auth, globalThis.__initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (selectedRole) => {
    setRole(selectedRole);
  };

  const handleLogout = () => {
    setRole(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  // Router Logic
  if (!role) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (role === 'citizen') {
    return <CitizenDashboard user={user} onLogout={handleLogout} />;
  }

  if (role === 'authority') {
    return <AuthorityDashboard onLogout={handleLogout} />;
  }

  if (role === 'recycler') {
    return <RecyclerDashboard onLogout={handleLogout} />;
  }

  return <div>Error: Unknown State</div>;
} 