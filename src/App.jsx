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
  CheckCircle, Clock, AlertTriangle, User, Building2, Truck
} from 'lucide-react';

/* --- FIREBASE CONFIGURATION & SETUP --- */
let firebaseConfig;


const hardcodedConfig = {
  apiKey: "AIzaSyBrD71MIMtC9_vJ9SC45xB2KUKk3p3leFw",
  authDomain: "clean-ghana-app.firebaseapp.com",
  projectId: "clean-ghana-app",
  storageBucket: "clean-ghana-app.firebase-storage.app",
  messagingSenderId: "805375125732",
  appId: "1:805375125732:web:3a51de0177123006e764f1",
  measurementId: "G-SLBBM6NYHB"
};

// Set default to hardcoded (works on Netlify/Vercel)
firebaseConfig = hardcodedConfig;


try {
  if (typeof globalThis.__firebase_config !== 'undefined' && globalThis.__firebase_config) {
    // If we are in the sandbox, use the sandbox keys instead
    firebaseConfig = typeof globalThis.__firebase_config === 'string' ? JSON.parse(globalThis.__firebase_config) : globalThis.__firebase_config;
  }
} catch (err) {
  console.warn('Failed to parse injected __firebase_config:', err);
}

// Final Safety Check
if (!firebaseConfig) {
  console.error("Firebase Configuration is missing!");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);



// Helper to get App ID for paths
const appId = (typeof globalThis.__app_id !== 'undefined' ? globalThis.__app_id : 'clean-ghana-app');


/* --- COMPONENTS --- */

// --- 1. LOGIN SCREEN ---
const LoginScreen = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-lg md:max-w-xl">
        <div className="flex justify-center mb-6">
          <div className="bg-green-600 p-4 rounded-full shadow-lg">
            <Recycle className="w-10 h-10 text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-extrabold text-center text-gray-900 mb-2">CleanGhana</h1>
        <p className="text-center text-gray-500 mb-10">Smart Waste Reporting & Recycling Platform</p>
        
        <div className="space-y-4">
          <button 
            onClick={() => onLogin('citizen')}
            className="w-full flex items-center p-5 border-2 border-green-200 rounded-xl bg-green-50 hover:bg-green-100 hover:border-green-500 transition-all duration-300 group shadow-md"
          >
            <div className="bg-green-200 p-3 rounded-xl mr-4 group-hover:bg-green-300 transition-colors">
              <User className="text-green-800" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-800">Citizen</h3>
              <p className="text-sm text-gray-500">Report waste & request pickups</p>
            </div>
          </button>

          <button 
            onClick={() => onLogin('authority')}
            className="w-full flex items-center p-5 border-2 border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 hover:border-blue-500 transition-all duration-300 group shadow-md"
          >
            <div className="bg-blue-200 p-3 rounded-xl mr-4 group-hover:bg-blue-300 transition-colors">
              <Building2 className="text-blue-800" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-800">Sanitation Authority</h3>
              <p className="text-sm text-gray-500">Manage reports & clearance</p>
            </div>
          </button>

          <button 
            onClick={() => onLogin('recycler')}
            className="w-full flex items-center p-5 border-2 border-orange-200 rounded-xl bg-orange-50 hover:bg-orange-100 hover:border-orange-500 transition-all duration-300 group shadow-md"
          >
            <div className="bg-orange-200 p-3 rounded-xl mr-4 group-hover:bg-orange-300 transition-colors">
              <Truck className="text-orange-800" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-800">Recycling Company</h3>
              <p className="text-sm text-gray-500">View ready-to-collect items</p>
            </div>
          </button>
        </div>
      </div>
      <p className="mt-10 text-gray-400 text-xs">Final Year Project Mockup | User ID: {auth.currentUser?.uid || 'Loading...'}</p>
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
        console.error("Location retrieval failed (Code: " + error.code + "):", error.message || error);
        
        // Fallback for demo if permission denied or location fails
        setLocation({ 
          lat: 5.6037, 
          lng: -0.1870, 
          address: "Legon, Accra (Demo Location Fallback)" 
        }); 
        
        setLocationStatus('success'); 
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
    if (!description || !location) return console.log("Please add description and location");
    
    setLoading(true);
    try {
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
      <div className="bg-green-700 text-white p-4 shadow-xl sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Recycle className="h-6 w-6 text-green-300" /> CleanGhana Citizen
          </h2>
          <button onClick={onLogout} className="text-sm bg-green-600 px-3 py-1 rounded-lg hover:bg-green-500 transition-colors">
            <LogOut className="h-4 w-4 inline mr-1"/> Logout
          </button>
        </div>
      </div>

      {/* Main Content Area - WIDER on Desktop */}
      <div className="max-w-7xl mx-auto p-4 mt-8">
        
        {/* Navigation Tabs (Improved Style) */}
        <div className="flex bg-white rounded-2xl shadow-xl p-2 mb-8 border border-gray-100 max-w-xl md:max-w-4xl mx-auto">
          <button 
            onClick={() => setActiveTab('report')}
            className={`flex-1 py-3 rounded-xl text-base font-semibold transition-all duration-300 ${activeTab === 'report' ? 'bg-red-500 text-white shadow-md shadow-red-200' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <AlertTriangle className="h-5 w-5 inline mr-1"/> Report Waste
          </button>
          <button 
            onClick={() => setActiveTab('recycle')}
            className={`flex-1 py-3 rounded-xl text-base font-semibold transition-all duration-300 ${activeTab === 'recycle' ? 'bg-green-600 text-white shadow-md shadow-green-200' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Recycle className="h-5 w-5 inline mr-1"/> Recycle Pickup
          </button>
        </div>

        {/* Content Area - Now uses a responsive grid */}
        {activeTab === 'report' ? (
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-xl md:max-w-6xl mx-auto">
            <div className="text-center mb-6">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 border-4 border-red-100">
                <AlertTriangle className="text-red-600 h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800">Illegal Dumping Report</h3>
              <p className="text-sm text-gray-500">Document the issue for sanitation action.</p>
            </div>

            <form onSubmit={handleSubmitReport} className="grid md:grid-cols-2 gap-6 md:gap-8">
                {/* LEFT COLUMN: Image & Location */}
                <div className="md:order-last space-y-6">
                    {/* Camera Input Section */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Photo of Waste Site</label>
                        
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
                          className={`border-2 border-dashed rounded-xl p-0 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 cursor-pointer transition-colors overflow-hidden relative ${imagePreview ? 'border-red-500 h-64' : 'border-gray-300 h-40'}`}
                        >
                          {imagePreview ? (
                            <>
                              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <span className="text-white font-bold flex items-center gap-2 text-lg"><Camera className="h-6 w-6"/> Change Photo</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center p-8">
                              <Camera className="h-10 w-10 mb-2 text-gray-500" />
                              <span className="text-sm font-medium">Tap to take photo</span>
                            </div>
                          )}
                        </div>
                    </div>

                    {/* Location Button */}
                    <div>
                        <button 
                          type="button"
                          onClick={handleGetLocation}
                          className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl text-base font-semibold transition-all duration-300 shadow-md ${locationStatus === 'success' ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-300' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                        >
                          <MapPin className="h-5 w-5" />
                          {locationStatus === 'idle' && "1. Get GPS Location"}
                          {locationStatus === 'locating' && "Locating..."}
                          {locationStatus === 'success' && location && (
                              <span className="truncate">{location.address}</span>
                          )}
                          {locationStatus === 'error' && "Retry Location"}
                        </button>
                    </div>
                </div>

                {/* RIGHT COLUMN: Description & Submit */}
                <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                      <textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g., Overflowing bin near the main road. Mostly household rubbish and plastics."
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-4 focus:ring-red-200 outline-none transition-shadow"
                        rows="6"
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={loading || !location || !description}
                      className="w-full bg-red-600 text-white py-4 mt-6 rounded-xl font-bold text-lg shadow-xl shadow-red-200 hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Submitting...' : 'Submit Waste Report'}
                    </button>
                </div>
            </form>
          </div>
        ) : (
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-xl md:max-w-6xl mx-auto">
            <div className="text-center mb-6">
              <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 border-4 border-green-100">
                <Recycle className="text-green-600 h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800">Recycling Pickup Request</h3>
              <p className="text-sm text-gray-500">Schedule collection of sorted materials.</p>
            </div>

            <form onSubmit={handleSubmitRecycle} className="grid md:grid-cols-2 gap-6 md:gap-8">
              {/* LEFT COLUMN: Material & Quantity */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Material Type</label>
                  <select 
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-4 focus:ring-green-200 outline-none appearance-none cursor-pointer"
                  >
                    <option>Plastic Bottles (PET)</option>
                    <option>Water Sachets</option>
                    <option>Cardboard / Paper</option>
                    <option>Aluminum Cans</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Estimated Quantity</label>
                  <input 
                    type="text"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="e.g., 2 large bags or 10kg"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-4 focus:ring-green-200 outline-none"
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: Location & Submit */}
              <div className="space-y-6 md:pt-8"> 
                 <div>
                    <button 
                      type="button"
                      onClick={handleGetLocation}
                      className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl text-base font-semibold transition-all duration-300 shadow-md ${locationStatus === 'success' ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-300' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                    >
                      <MapPin className="h-5 w-5" />
                      {locationStatus === 'idle' && "1. Get Pickup Location"}
                      {locationStatus === 'locating' && "Locating..."}
                      {locationStatus === 'success' && location && (
                          <span className="truncate">{location.address}</span>
                      )}
                      {locationStatus === 'error' && "Retry Location"}
                    </button>
                 </div>

                <button 
                  type="submit" 
                  disabled={loading || !location || !qty}
                  className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Requesting...' : 'Request Pickup'}
                </button>
              </div>

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

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const resolvedCount = reports.filter(r => r.status === 'resolved').length;
  const totalReports = reports.length;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-blue-800 text-white p-4 shadow-xl sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-7xl mx-auto w-full px-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-300" /> Sanitation Authority
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm bg-blue-700 px-3 py-1 rounded-full hidden md:inline-block">District: Ayawaso West</span>
            <button onClick={onLogout} className="text-sm bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg">
              <LogOut className="h-4 w-4 inline mr-1"/> Logout
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        
        {/* Stats Card - Now a responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            {/* Total Reports */}
            <div className="bg-white p-6 rounded-2xl shadow-xl border-b-4 border-blue-600">
                <h3 className="text-gray-500 font-medium text-lg">Total Reports</h3>
                <p className="text-4xl font-extrabold text-gray-900 mt-1">{totalReports}</p>
            </div>
            {/* Pending Issues */}
            <div className="bg-white p-6 rounded-2xl shadow-xl border-b-4 border-red-600">
                <h3 className="text-gray-500 font-medium text-lg">Pending Issues</h3>
                <p className="text-4xl font-extrabold text-red-600 mt-1">{pendingCount}</p>
            </div>
            {/* Resolved Issues */}
            <div className="bg-white p-6 rounded-2xl shadow-xl border-b-4 border-green-600">
                <h3 className="text-gray-500 font-medium text-lg">Resolved Issues</h3>
                <p className="text-4xl font-extrabold text-green-600 mt-1">{resolvedCount}</p>
            </div>
        </div>

        {/* List of Reports */}
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Report Queue</h3>
          {reports.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl text-gray-400 border border-dashed border-gray-300">
                <Clock className="h-8 w-8 mx-auto mb-2"/>
                <p>No active reports found. The streets are clean!</p>
              </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {reports.map((report) => (
                <div 
                  key={report.id} 
                  className={`bg-white rounded-2xl shadow-lg border overflow-hidden flex flex-col transition-shadow hover:shadow-2xl ${report.status === 'resolved' ? 'border-green-300' : 'border-red-300'}`}
                >
                  <div className="h-48 bg-gray-200 relative">
                    <img 
                      src={report.imageUrl} 
                      alt="Waste" 
                      className="w-full h-full object-cover" 
                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/600x400/e2e8f0/1e293b?text=Image+Unavailable'; }}
                    />
                    <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold uppercase shadow-md ${report.status === 'pending' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                      {report.status}
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start gap-2 mb-3 text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                      <span className="font-medium line-clamp-1">{report.location?.address || "Unknown Location"}</span>
                    </div>
                    <p className="text-gray-800 font-medium mb-4 line-clamp-3 flex-1 text-base">"{report.description}"</p>
                    
                    {report.status === 'pending' ? (
                      <button 
                        onClick={() => markResolved(report.id)}
                        className="mt-auto w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-bold shadow-md shadow-blue-200"
                      >
                        <CheckCircle className="h-5 w-5" /> Mark Resolved
                      </button>
                    ) : (
                      <div className="mt-auto w-full bg-green-100 text-green-700 py-3 rounded-xl text-center text-sm font-bold border border-green-200">
                        <CheckCircle className="h-4 w-4 inline mr-1"/> Successfully Resolved
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
      <div className="bg-orange-600 text-white p-4 shadow-xl sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-7xl mx-auto w-full px-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-orange-300" /> Jekora Ventures Portal
          </h2>
          <button onClick={onLogout} className="text-sm bg-orange-700 hover:bg-orange-500 px-3 py-1 rounded-lg">
            <LogOut className="h-4 w-4 inline mr-1"/> Logout
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Recycle className="h-6 w-6 text-green-600" />
          Recycling Pickups Queue
        </h3>

        {requests.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border-4 border-dashed border-gray-200">
            <Recycle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium text-lg">No pickup requests available yet.</p>
            <p className="text-sm text-gray-400">Check back later for new citizen requests.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((req) => (
              <div 
                key={req.id} 
                className={`bg-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:shadow-xl ${req.status === 'collected' ? 'opacity-70 bg-gray-50 border-l-4 border-gray-300' : 'border-l-4 border-green-500'}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${req.status === 'collected' ? 'bg-gray-200' : 'bg-green-100'}`}>
                    <Recycle className={`h-6 w-6 ${req.status === 'collected' ? 'text-gray-600' : 'text-green-700'}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xl text-gray-800">{req.materialType}</h4>
                    <p className="text-base text-gray-600 font-medium">Quantity: {req.quantity}</p>
                    <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                      <MapPin className="h-4 w-4"/>
                      <span className="line-clamp-1">{req.location?.address}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Requested: {req.timestamp ? new Date(req.timestamp.seconds * 1000).toLocaleDateString('en-GH') : 'Just now'}
                    </p>
                  </div>
                </div>

                {req.status === 'ready' ? (
                  <button 
                    onClick={() => markCollected(req.id)}
                    className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-md shadow-orange-200 whitespace-nowrap"
                  >
                    <Truck className="h-5 w-5 inline mr-1"/> Confirm Pickup
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-green-700 font-bold bg-green-100 px-4 py-3 rounded-xl border border-green-200 whitespace-nowrap shadow-inner">
                    <CheckCircle className="h-5 w-5" /> Collected
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-green-600"></div>
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