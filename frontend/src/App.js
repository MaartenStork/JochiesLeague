import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Chess } from 'chess.js';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Helper to get auth token from localStorage
const getAuthToken = () => localStorage.getItem('auth_token');

// Helper to get fetch options with auth
const getAuthHeaders = () => {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardDate, setLeaderboardDate] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [message, setMessage] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  
  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [verifiedLocation, setVerifiedLocation] = useState(null);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Flying Job state
  const [showFlyingJob, setShowFlyingJob] = useState(false);
  const [jobPosition, setJobPosition] = useState({ fromLeft: true });

  // Draggable B easter egg
  const [bPlaced, setBPlaced] = useState(false);
  const [isDraggingB, setIsDraggingB] = useState(false);
  const bRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Cheat code console
  const [cheatConsoleOpen, setCheatConsoleOpen] = useState(false);
  const [cheatCode, setCheatCode] = useState('');
  const [cheatMessage, setCheatMessage] = useState('');

  // Chess game
  const [showChess, setShowChess] = useState(false);
  const [chess, setChess] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [boardState, setBoardState] = useState([]);

  // Profile dropdown
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Ian flashbang easter egg
  const [showIanFlashbang, setShowIanFlashbang] = useState(false);
  const [ianFadingOut, setIanFadingOut] = useState(false);
  const ianGifRef = useRef(null);

  // Smiling Friends pop-up easter eggs (can all show simultaneously)
  const [showPim, setShowPim] = useState(false);
  const [showCharlie, setShowCharlie] = useState(false);
  const [showBoss, setShowBoss] = useState(false);
  const [showAlan, setShowAlan] = useState(false);
  const [showGlep, setShowGlep] = useState(false);
  const [sfStaggered, setSfStaggered] = useState(false); // Stagger only for group spawn

  // Check for auth token in URL on first load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('auth_token');
    if (token) {
      localStorage.setItem('auth_token', token);
      // Clean the URL without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch current user
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/user`, { 
        credentials: 'include',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.authenticated) {
        setUser(data.user);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch check-in status
  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/status`, { 
        credentials: 'include',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.checked_in) {
        setCheckedIn(true);
        setCheckInTime(data.check_in_time);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  }, [user]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/leaderboard`);
      const data = await res.json();
      setLeaderboard(data.leaderboard);
      setLeaderboardDate(data.date);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    }
  }, []);

  useEffect(() => {
    fetchUser();
    fetchLeaderboard();
  }, [fetchUser, fetchLeaderboard]);

  useEffect(() => {
    if (user) {
      fetchStatus();
    }
  }, [user, fetchStatus]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Flying Job easter egg - appears randomly every 1-3 minutes
  useEffect(() => {
    const scheduleNextJob = () => {
      // Random interval between 1-3 minutes (60,000 - 180,000 ms)
      const nextInterval = 60000 + Math.random() * 120000;
      
      return setTimeout(() => {
        // Random direction
        const fromLeft = Math.random() > 0.5;
        // Random start and end heights (10% to 80% of screen)
        const startY = 10 + Math.random() * 70;
        const endY = 10 + Math.random() * 70;
        // Random trajectory type
        const trajectories = ['straight', 'wavy', 'loop', 'bounce', 'spiral'];
        const trajectory = trajectories[Math.floor(Math.random() * trajectories.length)];
        // Random speed (2-4 seconds)
        const duration = 2 + Math.random() * 2;
        
        setJobPosition({ fromLeft, startY, endY, trajectory, duration });
        setShowFlyingJob(true);
        // Hide after animation completes
        setTimeout(() => setShowFlyingJob(false), duration * 1000);
        
        // Schedule next appearance
        timeoutRef.current = scheduleNextJob();
      }, nextInterval);
    };

    const timeoutRef = { current: scheduleNextJob() };

    return () => clearTimeout(timeoutRef.current);
  }, []);

  const handleJobClick = (e) => {
    e.stopPropagation();
    // Confetti from both bottom corners!
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { x: 0.1, y: 1 },
      angle: 60,
      colors: ['#00ff88', '#ffd700', '#ff4466', '#00ddaa']
    });
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { x: 0.9, y: 1 },
      angle: 120,
      colors: ['#00ff88', '#ffd700', '#ff4466', '#00ddaa']
    });
    setShowFlyingJob(false);
  };

  // Draggable B handlers
  const handleBDragStart = (e) => {
    setIsDraggingB(true);
    e.dataTransfer.setData('text/plain', 'B');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleBDragEnd = () => {
    setIsDraggingB(false);
  };

  const handleDropZoneDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropZoneDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.getData('text/plain') === 'B') {
      setBPlaced(true);
      // Celebration!
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { x: 0.5, y: 0.3 },
        colors: ['#00ff88', '#ffd700', '#ff4466', '#00ddaa']
      });
    }
  };

  // Touch drag for mobile
  const handleBTouchStart = (e) => {
    e.preventDefault();
    setIsDraggingB(true);
  };

  const handleBTouchMove = (e) => {
    e.preventDefault();
    if (!bRef.current) return;
    const touch = e.touches[0];
    bRef.current.style.position = 'fixed';
    bRef.current.style.left = `${touch.clientX - 20}px`;
    bRef.current.style.top = `${touch.clientY - 20}px`;
    bRef.current.style.zIndex = '10000';
    bRef.current.style.fontSize = '2rem';
    bRef.current.style.color = '#ffd700';
    bRef.current.style.textShadow = '0 0 20px #ffd700';
  };

  const handleBTouchEnd = (e) => {
    if (!bRef.current || !dropZoneRef.current) return;
    const touch = e.changedTouches[0];
    const dropRect = dropZoneRef.current.getBoundingClientRect();
    
    // Add some tolerance (50px extra on each side)
    const tolerance = 50;
    if (
      touch.clientX >= dropRect.left - tolerance &&
      touch.clientX <= dropRect.right + tolerance &&
      touch.clientY >= dropRect.top - tolerance &&
      touch.clientY <= dropRect.bottom + tolerance
    ) {
      setBPlaced(true);
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { x: 0.5, y: 0.3 },
        colors: ['#00ff88', '#ffd700', '#ff4466', '#00ddaa']
      });
    }
    
    // Reset position
    bRef.current.style.position = '';
    bRef.current.style.left = '';
    bRef.current.style.top = '';
    bRef.current.style.zIndex = '';
    bRef.current.style.fontSize = '';
    bRef.current.style.color = '';
    bRef.current.style.textShadow = '';
    setIsDraggingB(false);
  };

  // Cheat code handler
  const handleCheatSubmit = (e) => {
    e.preventDefault();
    const code = cheatCode.toLowerCase().trim();
    
    // Add your cheat codes here!
    let success = true;
    switch(code) {
      case 'job':
      case 'labubu':
      case 'job labubu':
      case 'labubu job':
      case 'joblabubu':
      case 'labubujob':
        setShowFlyingJob(true);
        setJobPosition({ 
          fromLeft: Math.random() > 0.5, 
          startY: 10 + Math.random() * 70,
          endY: 10 + Math.random() * 70,
          trajectory: ['straight', 'wavy', 'loop', 'bounce', 'spiral'][Math.floor(Math.random() * 5)],
          duration: 3
        });
        setTimeout(() => setShowFlyingJob(false), 3000);
        break;
      case 'chess':
      case 'schaken':
      case 'schaak':
      case 'chessgame':
      case 'chess game':
        startChessGame();
        break;
      case 'ian':
        setShowIanFlashbang(true);
        setIanFadingOut(false);
        // Reset GIF by clearing and re-setting src (restarts from frame 1)
        setTimeout(() => {
          if (ianGifRef.current) {
            const src = ianGifRef.current.src;
            ianGifRef.current.src = '';
            ianGifRef.current.src = src;
          }
        }, 10);
        // GIF is 2s, wait extra 2s on final frame, then fade out over 1s
        setTimeout(() => setIanFadingOut(true), 4000);
        setTimeout(() => {
          setShowIanFlashbang(false);
          setIanFadingOut(false);
        }, 5000);
        break;
      case 'reset':
        document.body.style.setProperty('--accent', '#00ff88');
        break;
      // Smiling Friends characters
      case 'pim':
        setSfStaggered(false);
        setShowPim(true);
        setTimeout(() => setShowPim(false), 4000);
        break;
      case 'charlie':
        setSfStaggered(false);
        setShowCharlie(true);
        setTimeout(() => setShowCharlie(false), 4000);
        break;
      case 'boss':
      case 'the boss':
      case 'theboss':
        setSfStaggered(false);
        setShowBoss(true);
        setTimeout(() => setShowBoss(false), 4000);
        break;
      case 'alan':
        setSfStaggered(false);
        setShowAlan(true);
        setTimeout(() => setShowAlan(false), 4000);
        break;
      case 'glep':
        setSfStaggered(false);
        setShowGlep(true);
        setTimeout(() => setShowGlep(false), 4000);
        break;
      case 'smiling friends':
      case 'smilingfriends':
      case 'smiling friend':
      case 'smilingfriend':
        setSfStaggered(true);
        setShowPim(true);
        setShowCharlie(true);
        setShowBoss(true);
        setShowAlan(true);
        setShowGlep(true);
        setTimeout(() => {
          setShowPim(false);
          setShowCharlie(false);
          setShowBoss(false);
          setShowAlan(false);
          setShowGlep(false);
        }, 5000);
        break;
      default:
        setCheatMessage('❌ Unknown code...');
        success = false;
    }
    
    // On successful cheat code, close console (dismisses keyboard on mobile)
    if (success) {
      setCheatConsoleOpen(false);
      // Blur input to ensure keyboard dismisses on mobile
      if (document.activeElement) {
        document.activeElement.blur();
      }
    }
    
    setCheatCode('');
    setTimeout(() => setCheatMessage(''), 2000);
  };

  // Chess game functions
  const startChessGame = () => {
    const newGame = new Chess();
    setChess(newGame);
    setBoardState(newGame.board());
    setSelectedSquare(null);
    setShowChess(true);
    setCheatConsoleOpen(false);
  };

  const getPieceSymbol = (piece) => {
    if (!piece) return '';
    const symbols = {
      'w': { 'k': '♔', 'q': '♕', 'r': '♖', 'b': '♗', 'n': '♘', 'p': '♙' },
      'b': { 'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟' }
    };
    return symbols[piece.color][piece.type];
  };

  const getSquareName = (row, col) => {
    const files = 'abcdefgh';
    return files[col] + (8 - row);
  };

  // Chess AI - Simple but effective minimax
  const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  
  const evaluateBoard = (game) => {
    let score = 0;
    const board = game.board();
    for (let row of board) {
      for (let piece of row) {
        if (piece) {
          const value = pieceValues[piece.type];
          score += piece.color === 'w' ? value : -value;
        }
      }
    }
    return score;
  };

  const minimax = (game, depth, alpha, beta, isMaximizing) => {
    if (depth === 0 || game.isGameOver()) {
      return evaluateBoard(game);
    }
    const moves = game.moves();
    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let move of moves) {
        game.move(move);
        const evaluation = minimax(game, depth - 1, alpha, beta, false);
        game.undo();
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let move of moves) {
        game.move(move);
        const evaluation = minimax(game, depth - 1, alpha, beta, true);
        game.undo();
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  };

  const makeAIMove = (game) => {
    const moves = game.moves();
    if (moves.length === 0) return null;
    
    let bestMove = null;
    let bestValue = Infinity;
    
    for (let move of moves) {
      game.move(move);
      const value = minimax(game, 2, -Infinity, Infinity, true);
      game.undo();
      if (value < bestValue) {
        bestValue = value;
        bestMove = move;
      }
    }
    return bestMove;
  };

  const handleSquareClick = (row, col) => {
    if (!chess || chess.turn() !== 'w') return; // Player is white
    const squareName = getSquareName(row, col);
    const piece = chess.get(squareName);

    if (selectedSquare) {
      // Try to make a move
      try {
        const move = chess.move({
          from: selectedSquare,
          to: squareName,
          promotion: 'q'
        });
        
        if (move) {
          setBoardState(chess.board());
          setSelectedSquare(null);
          
          // Check if player won
          if (chess.isCheckmate()) {
            setTimeout(() => {
              confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
              alert('♔ You win! Checkmate!');
            }, 100);
            return;
          } else if (chess.isDraw()) {
            setTimeout(() => alert("It's a draw!"), 100);
            return;
          }
          
          // AI moves after short delay
          setTimeout(() => {
            const aiMove = makeAIMove(chess);
            if (aiMove) {
              chess.move(aiMove);
              setBoardState(chess.board());
              
              if (chess.isCheckmate()) {
                setTimeout(() => alert('♚ AI wins! Checkmate!'), 100);
              } else if (chess.isDraw()) {
                setTimeout(() => alert("It's a draw!"), 100);
              }
            }
          }, 300);
          return;
        }
      } catch (e) {
        // Invalid move
      }
      setSelectedSquare(null);
    }
    
    // Select a piece (only white)
    if (piece && piece.color === 'w') {
      setSelectedSquare(squareName);
    } else {
      setSelectedSquare(null);
    }
  };

  const resetChessGame = () => {
    const newGame = new Chess();
    setChess(newGame);
    setBoardState(newGame.board());
    setSelectedSquare(null);
  };

  const handleLogin = () => {
    window.location.href = `${API_URL}/auth/login`;
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    window.location.href = `${API_URL}/auth/logout`;
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setMessage({ type: 'error', text: 'Could not access camera. Please allow camera permissions.' });
      setShowCamera(false);
      setVerifiedLocation(null);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
    setVerifiedLocation(null);
  };

  const handleCheckIn = async () => {
    if (checkedIn || checkingIn) return;

    setGettingLocation(true);
    setMessage(null);

    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation is not supported by your browser' });
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setGettingLocation(false);
        const { latitude, longitude } = position.coords;

        try {
          // Step 1: Verify location
          const res = await fetch(`${API_URL}/api/verify-location`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({ latitude, longitude }),
          });

          const data = await res.json();

          if (res.ok) {
            // Location verified! Show camera
            setVerifiedLocation({ latitude, longitude, distance: data.distance });
            setShowCamera(true);
            setMessage({ 
              type: 'success', 
              text: `📍 Location verified! ${data.distance}m from Science Park` 
            });
            // Start camera
            await startCamera();
          } else {
            setMessage({ 
              type: 'error', 
              text: data.error === 'Too far from Science Park' 
                ? `✗ You're ${data.distance}m away. Get within ${data.allowed_radius}m!`
                : data.error 
            });
          }
        } catch (err) {
          setMessage({ type: 'error', text: 'Failed to verify location. Try again.' });
        }
      },
      (error) => {
        setGettingLocation(false);
        let errorMsg = 'Failed to get location';
        if (error.code === 1) errorMsg = 'Location access denied. Enable location permissions!';
        if (error.code === 2) errorMsg = 'Location unavailable. Try again.';
        if (error.code === 3) errorMsg = 'Location request timed out. Try again.';
        setMessage({ type: 'error', text: errorMsg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !verifiedLocation) return;

    setCheckingIn(true);

    // Capture photo from video
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Convert to base64 (JPEG, reduced quality for smaller size)
    const photoData = canvas.toDataURL('image/jpeg', 0.7);

    try {
      // Step 2: Complete check-in with photo
      const res = await fetch(`${API_URL}/api/checkin`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          latitude: verifiedLocation.latitude,
          longitude: verifiedLocation.longitude,
          photo: photoData
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCheckedIn(true);
        setCheckInTime(data.check_in_time);
        setMessage({ 
          type: 'success', 
          text: `✓ Checked in successfully!` 
        });
        stopCamera();
        fetchLeaderboard();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to check in. Try again.' });
    } finally {
      setCheckingIn(false);
    }
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('nl-NL', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  if (loading) {
    return (
      <div className="app">
        <div className="spinner" />
      </div>
    );
  }

  // Camera view (full screen overlay)
  if (showCamera) {
    return (
      <div className="camera-overlay">
        <div className="camera-header">
          <button className="camera-close" onClick={stopCamera}>✕</button>
          <span className="camera-title">Take your check-in photo!</span>
        </div>
        
        <div className="camera-view">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-video"
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <div className="camera-controls">
          {message && (
            <div className={`camera-message ${message.type}`}>
              {message.text}
            </div>
          )}
          <button 
            className={`capture-btn ${checkingIn ? 'loading' : ''}`}
            onClick={takePhoto}
            disabled={checkingIn}
          >
            {checkingIn ? '⏳' : '📸'}
          </button>
          <p className="capture-hint">Tap to capture</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">Jo<span ref={dropZoneRef} className={`b-drop-zone ${isDraggingB ? 'active' : ''} ${bPlaced ? 'has-b' : ''}`} onDragOver={handleDropZoneDragOver} onDrop={handleDropZoneDrop}>{bPlaced && 'b'}</span>{bPlaced ? ' chies' : 'chies'} League</h1>
        <p className="tagline">Race to Science Park! 🏃‍♂️</p>
        
        {/* Profile icon - top right */}
        {user && (
          <div className="profile-menu">
            <img 
              src={user.picture} 
              alt={user.name} 
              className="profile-icon"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            />
            {profileDropdownOpen && (
              <>
                <div className="profile-backdrop" onClick={() => setProfileDropdownOpen(false)} />
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <div className="profile-dropdown-name">{user.name}</div>
                    <div className="profile-dropdown-email">{user.email}</div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-logout" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {user ? (
        <>

          {!checkedIn && (
            <div className="checkin-section">
              <button
                className={`checkin-btn ${(checkingIn || gettingLocation) ? 'loading' : ''}`}
                onClick={handleCheckIn}
                disabled={checkingIn || gettingLocation}
              >
                <span className="checkin-icon">
                  {gettingLocation ? '📍' : '🎯'}
                </span>
                {gettingLocation ? 'Getting Location...' : 'I am at Science Park'}
              </button>

              {message && (
                <div className={`checkin-status ${message.type}`}>
                  {message.text}
                </div>
              )}
            </div>
          )}

          {checkedIn && (
            <div className="checked-in-badge">
              <span className="badge-icon">✓</span>
              <span className="badge-text">Checked in at {checkInTime && formatTime(checkInTime)}</span>
            </div>
          )}
        </>
      ) : (
        <div className="login-section">
          <button className="login-btn" onClick={handleLogin}>
            <svg viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      )}

      {/* Compact Ranking */}
      <div className="ranking-section">
        <h2 className="ranking-title">
          🏆 Today's Ranking
          <span className="ranking-date">{leaderboardDate && formatDate(leaderboardDate)}</span>
        </h2>

        {leaderboard.length === 0 ? (
          <div className="ranking-empty">
            No check-ins yet today. Be the first! 🥇
          </div>
        ) : (
          <div className="ranking-list">
            {leaderboard.slice(0, 5).map((entry) => (
              <div key={entry.rank} className="ranking-entry">
                <div className={`rank-badge rank-${entry.rank <= 3 ? entry.rank : 'other'}`}>
                  {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                </div>
                <img src={entry.picture} alt={entry.name} className="ranking-avatar" />
                <span className="ranking-name">{entry.name.split(' ')[0]}</span>
                <span className="ranking-time">{formatTime(entry.check_in_time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instagram-style Feed */}
      {leaderboard.length > 0 && (
        <div className="feed-section">
          <h2 className="feed-title">📷 Today's {bPlaced ? 'atch' : <span className="batch-word"><span ref={bRef} className={`draggable-b ${isDraggingB ? 'dragging' : ''}`} draggable={!bPlaced} onDragStart={handleBDragStart} onDragEnd={handleBDragEnd} onTouchStart={handleBTouchStart} onTouchMove={handleBTouchMove} onTouchEnd={handleBTouchEnd}>B</span>atch</span>}</h2>
          
          <div className="feed">
            {leaderboard.map((entry) => (
              <div key={entry.rank} className="feed-card">
                <div className="feed-header">
                  <img src={entry.picture} alt={entry.name} className="feed-avatar" />
                  <div className="feed-user-info">
                    <span className="feed-name">{entry.name}</span>
                    <span className="feed-time">{formatTime(entry.check_in_time)}</span>
                  </div>
                  <div className={`feed-rank rank-${entry.rank <= 3 ? entry.rank : 'other'}`}>
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                  </div>
                </div>
                
                <div className="feed-photo-container">
                  {entry.photo ? (
                    <img src={entry.photo} alt={`${entry.name}'s check-in`} className="feed-photo" />
                  ) : (
                    <div className="feed-photo-placeholder">
                      <span>📍</span>
                      <p>No photo</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flying Job Easter Egg */}
      {showFlyingJob && (
        <div 
          className={`flying-job-wrapper ${jobPosition.fromLeft ? 'from-left' : 'from-right'} trajectory-${jobPosition.trajectory}`}
          style={{
            '--start-y': `${jobPosition.startY}%`,
            '--end-y': `${jobPosition.endY}%`,
            '--duration': `${jobPosition.duration}s`
          }}
          onClick={handleJobClick}
          onTouchStart={handleJobClick}
        >
          <img
            src="/JobLabubu.png"
            alt="Job"
            className="flying-job-img"
          />
        </div>
      )}

      {/* Smiling Friends Pop-ups */}
      {showPim && (
        <div className={`sf-popup sf-pim ${sfStaggered ? 'staggered' : ''}`}>
          <img src="/smilingfriends/pimnobackground.png" alt="Pim" />
        </div>
      )}
      {showCharlie && (
        <div className={`sf-popup sf-charlie ${sfStaggered ? 'staggered' : ''}`}>
          <img src="/smilingfriends/charlienobackground.png" alt="Charlie" />
        </div>
      )}
      {showBoss && (
        <div className={`sf-popup sf-boss ${sfStaggered ? 'staggered' : ''}`}>
          <img src="/smilingfriends/bossnobackground.png" alt="The Boss" />
        </div>
      )}
      {showAlan && (
        <div className={`sf-popup sf-alan ${sfStaggered ? 'staggered' : ''}`}>
          <img src="/smilingfriends/alannobackground.png" alt="Alan" />
        </div>
      )}
      {showGlep && (
        <div className={`sf-popup sf-glep ${sfStaggered ? 'staggered' : ''}`}>
          <img src="/smilingfriends/glepnobackground.png" alt="Glep" />
        </div>
      )}

      {/* Cheat Code Console */}
      {cheatConsoleOpen && (
        <div className="cheat-backdrop" onClick={() => setCheatConsoleOpen(false)} />
      )}
      <div className={`cheat-console ${cheatConsoleOpen ? 'open' : ''}`}>
        <div 
          className="cheat-tab"
          onClick={() => setCheatConsoleOpen(!cheatConsoleOpen)}
        >
          <span className="cheat-tab-icon">{cheatConsoleOpen ? '✕' : '⌨️'}</span>
        </div>
        <div className="cheat-panel">
          <form onSubmit={handleCheatSubmit}>
            <input
              type="text"
              value={cheatCode}
              onChange={(e) => setCheatCode(e.target.value)}
              placeholder="Enter code..."
              className="cheat-input"
              autoComplete="off"
              spellCheck="false"
            />
          </form>
          {cheatMessage && <div className="cheat-message">{cheatMessage}</div>}
        </div>
      </div>

      {/* Ian Flashbang Easter Egg */}
      {showIanFlashbang && (
        <div className={`ian-flashbang-overlay ${ianFadingOut ? 'fading-out' : ''}`}>
          <div className="ian-flashbang-flash" />
          <img 
            ref={ianGifRef}
            src="/ianmorph/ian_morph.gif"
            alt="Ian Morph"
            className="ian-flashbang-img"
          />
        </div>
      )}

      {/* Chess Game Modal */}
      {showChess && (
        <div className="chess-overlay" onClick={() => setShowChess(false)}>
          <div className="chess-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chess-header">
              <h2>♟️ Chess</h2>
              <button className="chess-close" onClick={() => setShowChess(false)}>✕</button>
            </div>
            <div className="chess-status">
              {chess && (chess.isCheckmate() ? 
                (chess.turn() === 'w' ? '♚ AI wins!' : '♔ You win!') :
                chess.isDraw() ? "Draw!" :
                chess.isCheck() ? `${chess.turn() === 'w' ? 'You are' : 'AI is'} in check!` :
                chess.turn() === 'w' ? 'Your turn (White)' : 'AI thinking...'
              )}
            </div>
            <div className="chess-board">
              {boardState.map((row, rowIndex) => (
                <div key={rowIndex} className="chess-row">
                  {row.map((piece, colIndex) => {
                    const squareName = getSquareName(rowIndex, colIndex);
                    const isLight = (rowIndex + colIndex) % 2 === 0;
                    const isSelected = selectedSquare === squareName;
                    return (
                      <div
                        key={colIndex}
                        className={`chess-square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSquareClick(rowIndex, colIndex)}
                      >
                        {piece && <span className={`chess-piece-${piece.color === 'w' ? 'white' : 'black'}`}>{getPieceSymbol(piece)}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <button className="chess-reset" onClick={resetChessGame}>New Game</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
