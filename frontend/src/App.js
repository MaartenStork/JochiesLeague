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

  // Flying Jobs state (array to support multiple Jobs at once)
  const [flyingJobs, setFlyingJobs] = useState([]);

  // Draggable B easter egg
  const [bPlaced, setBPlaced] = useState(false);
  const [isDraggingB, setIsDraggingB] = useState(false);
  const bRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Cheat code console
  const [cheatConsoleOpen, setCheatConsoleOpen] = useState(false);
  const [cheatCode, setCheatCode] = useState('');
  const [cheatMessage, setCheatMessage] = useState('');
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [monkeyCursor, setMonkeyCursor] = useState(false);

  // Chess game
  const [showChess, setShowChess] = useState(false);
  const [chess, setChess] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [boardState, setBoardState] = useState([]);

  // Profile dropdown
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Reactions state
  const [myReaction, setMyReaction] = useState(null); // { has_reacted: bool, reaction_type: 'like'/'dislike', checkin_id: number }
  const [reactingTo, setReactingTo] = useState(null); // checkin_id currently being reacted to (for loading state)

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
  const [sfGroupActive, setSfGroupActive] = useState(false); // Block individual triggers during group

  // Brainrot easter egg
  const [showBrainrotLeft, setShowBrainrotLeft] = useState(false);
  const [showBrainrotRight, setShowBrainrotRight] = useState(false);
  const [brainrotLoaded, setBrainrotLoaded] = useState({ left: false, right: false });

  // Rabbit clock (late check-in after 12:00)
  const [showRabbitClock, setShowRabbitClock] = useState(false);

  // FNAF jumpscare easter egg
  const [showFnaf, setShowFnaf] = useState(false);
  const fnafVideoRef = useRef(null);
  const fnafReversingRef = useRef(false);

  // 67 tilt easter egg
  const [show67Tilt, setShow67Tilt] = useState(false);

  // Secret tracking
  const [secretProgress, setSecretProgress] = useState(null);
  const [secretDropdownOpen, setSecretDropdownOpen] = useState(false);
  const [mobileSecretPopupOpen, setMobileSecretPopupOpen] = useState(false);

  // Progress bar shake easter egg
  const [isShakingBar, setIsShakingBar] = useState(false);
  const [barExploded, setBarExploded] = useState(false);
  const [barPosition, setBarPosition] = useState(null); // { x, y } when dragging
  const shakeDataRef = useRef({ startX: 0, startY: 0, movements: [], isGrabbing: false });
  const barShakeTimerRef = useRef(null);
  const barHoldTimerRef = useRef(null);
  const barRef = useRef(null);

  // Ranking game easter egg
  const [showRanking, setShowRanking] = useState(false);
  const [rankingAnswers, setRankingAnswers] = useState({1: null, 2: null, 3: null, 4: null, 5: null, 6: null});
  const [rankingComplete, setRankingComplete] = useState(false);
  const correctRanking = {1: 'Ian', 2: 'Tobias', 3: 'Derk', 4: 'Guru', 5: 'Job', 6: 'Niels'};
  const rankingNames = ['Derk', 'Maarten', 'Tobias', 'Maas', 'Job', 'Daan', 'Guru', 'Niels', 'Simo', 'Julian', 'Manka', 'Tibi', 'Ian'];

  // Theme system
  const [currentTheme, setCurrentTheme] = useState('default');
  const [unlockedThemes, setUnlockedThemes] = useState(['default']);
  
  const themes = {
    default: {
      name: 'Science Park',
      colors: {
        accent: '#00ff88',
        accentDim: '#00cc6a',
        accentGlow: 'rgba(0, 255, 136, 0.3)'
      },
      background: null
    },
    kabouter: {
      name: 'Kabouter',
      colors: {
        accent: '#ff4444',
        accentDim: '#cc3333',
        accentGlow: 'rgba(255, 68, 68, 0.3)'
      },
      background: '/kabouterbackground.png'
    },
    chess: {
      name: 'Chess Jobje',
      colors: {
        accent: '#d4af37',
        accentDim: '#b8941f',
        accentGlow: 'rgba(212, 175, 55, 0.3)'
      },
      background: null
    }
  };

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

  // Load saved theme from localStorage (unlocked themes come from secrets)
  useEffect(() => {
    const savedTheme = localStorage.getItem('currentTheme');
    
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme);
    }
  }, []);

  // Apply theme colors and background
  useEffect(() => {
    const theme = themes[currentTheme];
    if (theme) {
      document.documentElement.style.setProperty('--accent', theme.colors.accent);
      document.documentElement.style.setProperty('--accent-dim', theme.colors.accentDim);
      document.documentElement.style.setProperty('--accent-glow', theme.colors.accentGlow);
      
      // Set theme background and body class
      if (theme.background) {
        document.documentElement.style.setProperty('--theme-background', `url(${process.env.PUBLIC_URL}${theme.background})`);
      } else {
        document.documentElement.style.setProperty('--theme-background', 'none');
      }
      
      // Set appropriate body class for each theme
      if (currentTheme === 'kabouter') {
        document.body.className = 'theme-kabouter';
      } else if (currentTheme === 'chess') {
        document.body.className = 'theme-chess';
      } else {
        document.body.className = '';
      }
    }
  }, [currentTheme]);

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


  // Fetch secret progress
  const fetchSecretProgress = useCallback(async () => {
    if (!user) return;
    
    try {
      const res = await fetch(`${API_URL}/api/secret/progress`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      
      const data = await res.json();
      if (res.ok) {
        setSecretProgress(data);
        
        // Auto-unlock themes based on secrets
        const newUnlockedThemes = ['default'];
        
        // Check for kabouter theme
        if (data.found_secrets.includes('theme_kabouter')) {
          newUnlockedThemes.push('kabouter');
        }
        
        // Check for chess theme
        if (data.found_secrets.includes('chess_victory')) {
          newUnlockedThemes.push('chess');
        }
        
        // Update unlocked themes
        setUnlockedThemes(newUnlockedThemes);
        localStorage.setItem('unlockedThemes', JSON.stringify(newUnlockedThemes));
      }
    } catch (err) {
      console.error('Error fetching secret progress:', err);
    }
  }, [user]);

  // Track secret discovery with immediate UI update
  const discoverSecret = useCallback(async (secretCode) => {
    if (!user) return;
    
    try {
      const res = await fetch(`${API_URL}/api/secret/discover`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ secret_code: secretCode })
      });
      
      const data = await res.json();
      if (res.ok) {
        if (!data.already_found) {
          console.log(`🎉 New secret discovered: ${secretCode}! (${data.percentage}%)`);
        }
        // Immediately refresh progress to update the bar
        fetchSecretProgress();
      }
    } catch (err) {
      console.error('Error recording secret:', err);
    }
  }, [user, fetchSecretProgress]);

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

  // Fetch user's reaction for today
  const fetchMyReaction = useCallback(async () => {
    if (!user || !checkedIn) return;
    try {
      const res = await fetch(`${API_URL}/api/my-reaction`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setMyReaction(data);
    } catch (err) {
      console.error('Error fetching my reaction:', err);
    }
  }, [user, checkedIn]);

  useEffect(() => {
    fetchUser();
    fetchLeaderboard();
  }, [fetchUser, fetchLeaderboard]);

  useEffect(() => {
    if (user) {
      fetchStatus();
      fetchSecretProgress();
    }
  }, [user, fetchStatus, fetchSecretProgress]);

  useEffect(() => {
    if (user && checkedIn) {
      fetchMyReaction();
    }
  }, [user, checkedIn, fetchMyReaction]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Monkey cursor punishment for wrong cheat codes
  useEffect(() => {
    if (monkeyCursor) {
      const cursorNormal = 'url(/mouse/thinkingmonkey.png) 16 16, auto';
      const cursorClick = 'url(/mouse/thinkingmonkey2.png) 16 16, auto';
      
      // Apply cursor to html element to override everything
      const html = document.documentElement;
      html.style.setProperty('cursor', cursorNormal, 'important');
      
      const handleMouseDown = () => {
        html.style.setProperty('cursor', cursorClick, 'important');
      };
      const handleMouseUp = () => {
        html.style.setProperty('cursor', cursorNormal, 'important');
      };
      
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        html.style.cursor = '';
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    } else {
      document.documentElement.style.cursor = '';
    }
  }, [monkeyCursor]);

  // Helper function to spawn a flying Job
  const spawnFlyingJob = useCallback(() => {
    const id = Date.now() + Math.random(); // Unique ID for each Job
    const fromLeft = Math.random() > 0.5;
    const startY = 10 + Math.random() * 70;
    const endY = 10 + Math.random() * 70;
    const trajectories = ['straight', 'wavy', 'loop', 'bounce', 'spiral'];
    const trajectory = trajectories[Math.floor(Math.random() * trajectories.length)];
    const duration = 2 + Math.random() * 2;
    
    const newJob = { id, fromLeft, startY, endY, trajectory, duration };
    setFlyingJobs(prev => [...prev, newJob]);
    
    // Remove this specific Job after animation completes (with 500ms buffer)
    setTimeout(() => {
      setFlyingJobs(prev => prev.filter(job => job.id !== id));
    }, (duration * 1000) + 500);
    
    return newJob;
  }, []);

  // Flying Job easter egg - appears randomly every 1-3 minutes
  useEffect(() => {
    const scheduleNextJob = () => {
      // Random interval between 1-3 minutes (60,000 - 180,000 ms)
      const nextInterval = 60000 + Math.random() * 120000;
      
      return setTimeout(() => {
        spawnFlyingJob();
        // Schedule next appearance
        timeoutRef.current = scheduleNextJob();
      }, nextInterval);
    };

    const timeoutRef = { current: scheduleNextJob() };

    return () => clearTimeout(timeoutRef.current);
  }, [spawnFlyingJob]);

  const handleJobClick = (e, jobId) => {
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
    // Track secret discovery
    discoverSecret('job_click');
    // Remove the clicked Job
    setFlyingJobs(prev => prev.filter(job => job.id !== jobId));
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
      // Track secret discovery
      discoverSecret('b_drag');
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
      // Track secret discovery
      discoverSecret('b_drag');
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

  // Unlock a theme
  const unlockTheme = useCallback((themeId) => {
    if (!themes[themeId]) return false;
    
    // Always save to database, even if already unlocked locally
    if (themeId === 'kabouter') {
      discoverSecret('theme_kabouter');
    } else if (themeId === 'chess') {
      discoverSecret('chess_victory');
    }
    
    // Only show visual effects and update state if newly unlocked
    if (!unlockedThemes.includes(themeId)) {
      const newUnlockedThemes = [...unlockedThemes, themeId];
      setUnlockedThemes(newUnlockedThemes);
      localStorage.setItem('unlockedThemes', JSON.stringify(newUnlockedThemes));
      
      // Auto-switch to the new theme
      setCurrentTheme(themeId);
      localStorage.setItem('currentTheme', themeId);
      
      // Show themed confetti!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.3 },
        colors: [themes[themeId].colors.accent, themes[themeId].colors.accentDim, '#ffd700']
      });
      
      setCheatMessage(`🎨 ${themes[themeId].name} theme unlocked!`);
      
      return true;
    }
    
    // Already unlocked, but we still saved to database above
    setCheatMessage(`🎨 ${themes[themeId].name} theme already unlocked!`);
    return false;
  }, [unlockedThemes, themes, discoverSecret]);

  // Switch theme
  const switchTheme = useCallback((themeId) => {
    if (unlockedThemes.includes(themeId) && themes[themeId]) {
      setCurrentTheme(themeId);
      localStorage.setItem('currentTheme', themeId);
    }
  }, [unlockedThemes, themes]);

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
        spawnFlyingJob();
        discoverSecret('job_spawn'); // Typing "job" is a secret!
        // Note: job_click is tracked when clicking the flying job
        break;
      case 'chess':
      case 'schaken':
      case 'schaak':
      case 'chessgame':
      case 'chess game':
        startChessGame();
        discoverSecret('chess');
        break;
      case 'ian':
        setShowIanFlashbang(true);
        setIanFadingOut(false);
        discoverSecret('ian');
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
        setCurrentTheme('default');
        localStorage.setItem('currentTheme', 'default');
        setMonkeyCursor(false);
        setWrongAttempts(0);
        break;
      // Theme unlocks
      case 'kabouter':
      case 'kabouterborrel':
      case 'kabout borrel':
      case 'kabout':
        unlockTheme('kabouter');
        success = true;
        break;
      // Smiling Friends characters
      case 'pim':
        if (sfGroupActive) break; // Don't interrupt group animation
        setSfStaggered(false);
        setShowPim(true);
        discoverSecret('smiling_friends');
        setTimeout(() => setShowPim(false), 4000);
        break;
      case 'charlie':
        if (sfGroupActive) break;
        setSfStaggered(false);
        setShowCharlie(true);
        discoverSecret('smiling_friends');
        setTimeout(() => setShowCharlie(false), 4000);
        break;
      case 'boss':
      case 'the boss':
      case 'theboss':
        if (sfGroupActive) break;
        setSfStaggered(false);
        setShowBoss(true);
        discoverSecret('smiling_friends');
        setTimeout(() => setShowBoss(false), 4000);
        break;
      case 'alan':
        if (sfGroupActive) break;
        setSfStaggered(false);
        setShowAlan(true);
        discoverSecret('smiling_friends');
        setTimeout(() => setShowAlan(false), 4000);
        break;
      case 'glep':
        if (sfGroupActive) break;
        setSfStaggered(false);
        setShowGlep(true);
        discoverSecret('smiling_friends');
        setTimeout(() => setShowGlep(false), 4000);
        break;
      case 'ranking':
        setShowRanking(true);
        setRankingAnswers({1: null, 2: null, 3: null, 4: null, 5: null, 6: null});
        setRankingComplete(false);
        setRankingChecked(false);
        discoverSecret('ranking');
        break;
      case 'brainrot':
      case 'brain rot':
        setBrainrotLoaded({ left: false, right: false });
        setShowBrainrotLeft(true);
        setShowBrainrotRight(true);
        discoverSecret('brainrot');
        break;
      case 'rabbit':
      case 'konijn':
        setShowRabbitClock(true);
        setTimeout(() => setShowRabbitClock(false), 2200);
        break;
      case 'fnaf':
      case 'freddy':
      case 'jumpscare':
        setShowFnaf(true);
        discoverSecret('fnaf');
        break;
      case '67':
      case '6 7':
      case 'sixseven':
      case 'six seven':
        setShow67Tilt(true);
        discoverSecret('six_seven');
        setTimeout(() => setShow67Tilt(false), 2000);
        break;
      case 'smiling friends':
      case 'smilingfriends':
      case 'smiling friend':
      case 'smilingfriend':
        setSfGroupActive(true);
        setSfStaggered(true);
        setShowPim(true);
        setShowCharlie(true);
        setShowBoss(true);
        setShowAlan(true);
        setShowGlep(true);
        discoverSecret('smiling_friends');
        setTimeout(() => {
          setShowPim(false);
          setShowCharlie(false);
          setShowBoss(false);
          setShowAlan(false);
          setShowGlep(false);
          setSfGroupActive(false);
        }, 5000);
        break;
      case 'counter':
      case 'progress':
      case 'secrets':
        // Discover the counter secret (this will make the bar appear instantly)
        discoverSecret('counter');
        setCheatMessage('🎯 Secret counter unlocked!');
        success = true; // Don't count as wrong attempt
        break;
      default:
        const newAttempts = wrongAttempts + 1;
        setWrongAttempts(newAttempts);
        if (newAttempts >= 3) {
          setCheatMessage('ewa fout gedaan, aap tijd');
          setMonkeyCursor(true);
          discoverSecret('monkey_cursor'); // Monkey cursor is a secret!
        } else {
          setCheatMessage(`❌ Unknown code... (${newAttempts}/3)`);
        }
        success = false;
    }
    
    // On successful cheat code, close console (dismisses keyboard on mobile)
    if (success) {
      setCheatConsoleOpen(false);
      setWrongAttempts(0); // Reset wrong attempts on success
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
              // Unlock chess theme!
              const unlocked = unlockTheme('chess');
              confetti({ 
                particleCount: 200, 
                spread: 100, 
                origin: { y: 0.5 },
                colors: unlocked ? ['#d4af37', '#b8941f', '#ffd700'] : ['#00ff88', '#ffd700', '#ff4466']
              });
              alert('♔ Fakka Jobje ♔');
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

  // Ranking game functions
  const handleRankingDrop = (position, name) => {
    const newAnswers = { ...rankingAnswers };
    // Remove name from any other position
    Object.keys(newAnswers).forEach(key => {
      if (newAnswers[key] === name) newAnswers[key] = null;
    });
    newAnswers[position] = name;
    setRankingAnswers(newAnswers);
  };

  const [rankingChecked, setRankingChecked] = useState(false);
  
  const checkRankingAnswers = () => {
    setRankingChecked(true);
    const isCorrect = Object.keys(correctRanking).every(
      key => rankingAnswers[key] === correctRanking[key]
    );
    if (isCorrect) {
      setRankingComplete(true);
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
    }
  };
  
  const isAnswerCorrect = (pos) => {
    return rankingAnswers[pos] === correctRanking[pos];
  };

  const getAvailableNames = () => {
    const usedNames = Object.values(rankingAnswers).filter(n => n !== null);
    return rankingNames.filter(n => !usedNames.includes(n));
  };

  // Progress bar shake handlers
  const triggerBarExplosion = useCallback(() => {
    // Use ref to check if already exploding (state updates are async)
    if (shakeDataRef.current.hasExploded) return;
    
    shakeDataRef.current.hasExploded = true;
    shakeDataRef.current.isGrabbing = false;
    shakeDataRef.current.isDragging = false;
    
    setBarExploded(true);
    setIsShakingBar(false);
    
    // Get position for confetti origin
    const explosionOrigin = barPosition 
      ? { x: barPosition.x / window.innerWidth, y: barPosition.y / window.innerHeight }
      : { x: 0.5, y: 0.1 };
    
    // Massive confetti explosion!
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    
    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      
      if (timeLeft <= 0) {
        clearInterval(interval);
        // Reset after explosion
        setTimeout(() => {
          setBarExploded(false);
          setBarPosition(null);
          shakeDataRef.current.hasExploded = false;
        }, 1000);
        return;
      }
      
      const particleCount = 50;
      
      // Fire from the explosion point
      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: explosionOrigin,
        colors: ['#00ff88', '#ffd700', '#ff4466', '#00ddaa', '#ff6b35', '#4ecdc4']
      });
    }, 100);
    
    // Track secret discovery
    discoverSecret('bar_explosion');
  }, [barPosition, discoverSecret]);

  const startDragging = useCallback((clientX, clientY, rect) => {
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    
    shakeDataRef.current = {
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lastY: clientY,
      offsetX,
      offsetY,
      movements: [],
      isGrabbing: true,
      isDragging: true,
      lastTime: Date.now()
    };
    
    // Start dragging - position the bar at cursor
    setBarPosition({
      x: clientX - offsetX,
      y: clientY - offsetY
    });
    
    setIsShakingBar(false);
  }, []);

  const handleBarGrab = useCallback((e) => {
    if (barExploded || !barRef.current) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Get the bar's current position
    const rect = barRef.current.getBoundingClientRect();
    
    // Mark as potentially grabbing (but not dragging yet)
    shakeDataRef.current = {
      startX: clientX,
      startY: clientY,
      isGrabbing: true,
      isDragging: false,
      movements: [],
      lastTime: Date.now()
    };
    
    // Set a timer - if held for 200ms, start dragging
    barHoldTimerRef.current = setTimeout(() => {
      if (shakeDataRef.current.isGrabbing) {
        startDragging(clientX, clientY, rect);
      }
    }, 200);
  }, [barExploded, startDragging]);

  const handleBarMove = useCallback((e) => {
    // Only process movement if we're actually dragging (not just holding)
    if (!shakeDataRef.current.isGrabbing || !shakeDataRef.current.isDragging || shakeDataRef.current.hasExploded) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const now = Date.now();
    
    // Move the bar to follow cursor
    setBarPosition({
      x: clientX - shakeDataRef.current.offsetX,
      y: clientY - shakeDataRef.current.offsetY
    });
    
    const deltaX = clientX - shakeDataRef.current.lastX;
    const deltaY = clientY - shakeDataRef.current.lastY;
    const deltaTime = now - shakeDataRef.current.lastTime;
    
    // Calculate velocity
    const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / (deltaTime || 1);
    
    // Track movements
    shakeDataRef.current.movements.push({ velocity, time: now });
    shakeDataRef.current.lastX = clientX;
    shakeDataRef.current.lastY = clientY;
    shakeDataRef.current.lastTime = now;
    
    // Keep only recent movements (last 400ms - tighter window)
    shakeDataRef.current.movements = shakeDataRef.current.movements.filter(
      m => now - m.time < 400
    );
    
    // Check if shaking (multiple rapid movements with higher velocity threshold)
    const rapidMovements = shakeDataRef.current.movements.filter(m => m.velocity > 2.5);
    
    if (rapidMovements.length >= 8) {
      setIsShakingBar(true);
    }
    
    // Explode if shaking intensifies - need MANY fast movements
    if (rapidMovements.length >= 40) {
      triggerBarExplosion();
    }
  }, [triggerBarExplosion]);

  const handleBarRelease = useCallback(() => {
    const wasDragging = shakeDataRef.current.isDragging;
    
    // Cancel the hold timer if it hasn't fired yet
    if (barHoldTimerRef.current) {
      clearTimeout(barHoldTimerRef.current);
      barHoldTimerRef.current = null;
    }
    
    shakeDataRef.current.isGrabbing = false;
    shakeDataRef.current.isDragging = false;
    
    // Only animate back if we were actually dragging
    if (wasDragging) {
      // Reset position and shake visual after a delay
      if (barShakeTimerRef.current) {
        clearTimeout(barShakeTimerRef.current);
      }
      barShakeTimerRef.current = setTimeout(() => {
        setIsShakingBar(false);
        setBarPosition(null); // Return to original position
      }, 200);
    }
  }, []);

  // Add global mouse/touch move and up listeners
  useEffect(() => {
    const handleGlobalMove = (e) => {
      if (shakeDataRef.current.isGrabbing) {
        handleBarMove(e);
      }
    };
    
    const handleGlobalUp = () => {
      if (shakeDataRef.current.isGrabbing) {
        handleBarRelease();
      }
    };
    
    document.addEventListener('mousemove', handleGlobalMove);
    document.addEventListener('mouseup', handleGlobalUp);
    document.addEventListener('touchmove', handleGlobalMove, { passive: false });
    document.addEventListener('touchend', handleGlobalUp);
    document.addEventListener('touchcancel', handleGlobalUp);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalUp);
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('touchend', handleGlobalUp);
      document.removeEventListener('touchcancel', handleGlobalUp);
    };
  }, [handleBarMove, handleBarRelease]);

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
        
        // Check if check-in is after 12:00 - show rabbit clock!
        const checkInDate = new Date(data.check_in_time);
        if (checkInDate.getHours() >= 12) {
          setShowRabbitClock(true);
          setTimeout(() => setShowRabbitClock(false), 2200);
        }
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

  const handleReaction = async (checkinId, reactionType) => {
    if (!user || !checkedIn) {
      setMessage({ type: 'error', text: 'You must check in before giving reactions' });
      return;
    }

    // Prevent double-clicking
    if (reactingTo) return;

    setReactingTo(checkinId);

    try {
      const res = await fetch(`${API_URL}/api/react`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          checkin_id: checkinId,
          reaction_type: reactionType
        })
      });

      const data = await res.json();

      if (res.ok) {
        // Update local reaction state
        setMyReaction({
          has_reacted: true,
          reaction_type: reactionType,
          checkin_id: checkinId
        });
        // Refresh leaderboard to get updated counts
        fetchLeaderboard();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      console.error('Error giving reaction:', err);
      setMessage({ type: 'error', text: 'Failed to give reaction' });
    } finally {
      setReactingTo(null);
    }
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
    <div className={`app ${show67Tilt ? 'tilt-67' : ''}`}>
      <header className={`header ${!user ? 'login-header' : ''}`}>
        <h1 className="logo">Jo<span ref={dropZoneRef} className={`b-drop-zone ${isDraggingB ? 'active' : ''} ${bPlaced ? 'has-b' : ''}`} onDragOver={handleDropZoneDragOver} onDrop={handleDropZoneDrop}>{bPlaced && 'b'}</span>{bPlaced ? ' chies' : 'chies'} League</h1>
        <p className="tagline">SP grind time</p>
        
        {/* Profile icon - top right */}
        {user && (
          <div className="profile-menu">
            <img 
              src={user.picture} 
              alt={user.name} 
              className="profile-icon"
              onClick={() => {
                // On mobile, open secrets popup if available, otherwise profile dropdown
                const isMobile = window.innerWidth <= 768;
                if (isMobile && secretProgress && secretProgress.found_secrets.includes('counter')) {
                  setMobileSecretPopupOpen(!mobileSecretPopupOpen);
                  setProfileDropdownOpen(false);
                } else {
                  setProfileDropdownOpen(!profileDropdownOpen);
                }
              }}
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
            
            {/* Secret Counter Widget - only shows if user has found the "counter" secret */}
            {secretProgress && secretProgress.found_secrets.includes('counter') && (
              <div className="secret-counter-widget">
                <div 
                  ref={barRef}
                  className={`secret-counter-main ${isShakingBar ? 'shaking' : ''} ${barExploded ? 'exploded' : ''} ${barPosition ? 'dragging' : ''}`}
                  onClick={(e) => {
                    // Only toggle dropdown if it wasn't a drag
                    if (!barPosition && !isShakingBar) {
                      setSecretDropdownOpen(!secretDropdownOpen);
                    }
                  }}
                  onMouseDown={handleBarGrab}
                  onTouchStart={handleBarGrab}
                  style={{ 
                    cursor: barExploded ? 'not-allowed' : (barPosition ? 'grabbing' : 'pointer'),
                    ...(barPosition ? {
                      position: 'fixed',
                      left: `${barPosition.x}px`,
                      top: `${barPosition.y}px`,
                      zIndex: 10000
                    } : {})
                  }}
                >
                  <div className="secret-progress-bar">
                    <div 
                      className="secret-progress-fill"
                      style={{ width: barExploded ? '0%' : `${secretProgress.percentage}%` }}
                    />
                  </div>
                </div>
                
                {secretDropdownOpen && (
                  <>
                    <div className="secret-dropdown-backdrop" onClick={() => setSecretDropdownOpen(false)} />
                    <div className="secret-dropdown">
                      <div className="secret-list">
                        {secretProgress.found_secrets
                          .filter(secret => secret !== 'chess_victory' && secret !== 'theme_kabouter')
                          .map(secret => (
                            <div key={secret} className="secret-item">
                              ✓ {secret.replace(/_/g, ' ')}
                            </div>
                          ))}
                      </div>
                      
                      {/* Themes section */}
                      {unlockedThemes.length > 0 && (
                        <>
                          <div className="secret-divider" />
                          <div className="secret-themes-section">
                            <div className="secret-themes-header">🎨 Themes</div>
                            <div className="secret-themes-list">
                              {Object.keys(themes).map(themeId => {
                                const theme = themes[themeId];
                                const isUnlocked = unlockedThemes.includes(themeId);
                                const isActive = currentTheme === themeId;
                                
                                if (!isUnlocked) return null;
                                
                                return (
                                  <button
                                    key={themeId}
                                    className={`secret-theme-item ${isActive ? 'active' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      switchTheme(themeId);
                                    }}
                                  >
                                    <div 
                                      className="secret-theme-color"
                                      style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentDim})` }}
                                    />
                                    <span className="secret-theme-name">{theme.name}</span>
                                    {isActive && <span className="secret-theme-check">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* Mobile Secret Popup - Triggered by profile icon on mobile */}
            {mobileSecretPopupOpen && secretProgress && secretProgress.found_secrets.includes('counter') && (
              <>
                <div className="mobile-secret-backdrop" onClick={() => setMobileSecretPopupOpen(false)} />
                <div className="mobile-secret-popup">
                  <div className="mobile-secret-header">
                    <div className="mobile-secret-user">
                      <img src={user.picture} alt={user.name} className="mobile-secret-avatar" />
                      <div>
                        <div className="mobile-secret-name">{user.name}</div>
                        <button className="mobile-secret-logout" onClick={() => {
                          setMobileSecretPopupOpen(false);
                          handleLogout();
                        }}>
                          Logout
                        </button>
                      </div>
                    </div>
                    <button className="mobile-secret-close" onClick={() => setMobileSecretPopupOpen(false)}>✕</button>
                  </div>
                  
                  <div 
                    ref={barRef}
                    className={`secret-counter-main mobile-bar ${isShakingBar ? 'shaking' : ''} ${barExploded ? 'exploded' : ''} ${barPosition ? 'dragging' : ''}`}
                    onMouseDown={handleBarGrab}
                    onTouchStart={handleBarGrab}
                    style={{ 
                      cursor: barExploded ? 'not-allowed' : (barPosition ? 'grabbing' : 'grab'),
                      ...(barPosition ? {
                        position: 'fixed',
                        left: `${barPosition.x}px`,
                        top: `${barPosition.y}px`,
                        zIndex: 10000
                      } : {})
                    }}
                  >
                    <div className="secret-progress-bar">
                      <div 
                        className="secret-progress-fill"
                        style={{ width: barExploded ? '0%' : `${secretProgress.percentage}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="mobile-secret-content">
                    <div className="secret-list">
                      {secretProgress.found_secrets
                        .filter(secret => secret !== 'chess_victory' && secret !== 'theme_kabouter')
                        .map(secret => (
                          <div key={secret} className="secret-item">
                            ✓ {secret.replace(/_/g, ' ')}
                          </div>
                        ))}
                    </div>
                    
                    {/* Themes section */}
                    {unlockedThemes.length > 0 && (
                      <>
                        <div className="secret-divider" />
                        <div className="secret-themes-section">
                          <div className="secret-themes-header">🎨 Themes</div>
                          <div className="secret-themes-list">
                            {Object.keys(themes).map(themeId => {
                              const theme = themes[themeId];
                              const isUnlocked = unlockedThemes.includes(themeId);
                              const isActive = currentTheme === themeId;
                              
                              if (!isUnlocked) return null;
                              
                              return (
                                <button
                                  key={themeId}
                                  className={`secret-theme-item ${isActive ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    switchTheme(themeId);
                                  }}
                                >
                                  <div 
                                    className="secret-theme-color"
                                    style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentDim})` }}
                                  />
                                  <span className="secret-theme-name">{theme.name}</span>
                                  {isActive && <span className="secret-theme-check">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {!user ? (
        <div className="login-screen">
          <div className="login-content">
            <img src="/soyjack.png" alt="Soyjack" className="login-image" />
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
        </div>
      ) : (
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

                {/* Reaction buttons - only show if user is checked in and not their own post */}
                {user && checkedIn && entry.checkin_id && user.name !== entry.name && (
                  <div className="feed-reactions">
                    <button
                      className={`reaction-btn ${myReaction?.checkin_id === entry.checkin_id && myReaction?.reaction_type === 'like' ? 'active' : ''}`}
                      onClick={() => handleReaction(entry.checkin_id, 'like')}
                      disabled={reactingTo !== null}
                    >
                      👍 <span className="reaction-count">{entry.likes || 0}</span>
                    </button>
                    <button
                      className={`reaction-btn ${myReaction?.checkin_id === entry.checkin_id && myReaction?.reaction_type === 'dislike' ? 'active' : ''}`}
                      onClick={() => handleReaction(entry.checkin_id, 'dislike')}
                      disabled={reactingTo !== null}
                    >
                      👎 <span className="reaction-count">{entry.dislikes || 0}</span>
                    </button>
                  </div>
                )}

                {/* Show reaction counts even if user can't react */}
                {(!user || !checkedIn || user.name === entry.name) && (
                  <div className="feed-reactions-readonly">
                    <span className="reaction-stat">👍 {entry.likes || 0}</span>
                    <span className="reaction-stat">👎 {entry.dislikes || 0}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}

      {/* Flying Job Easter Eggs - multiple can exist at once */}
      {flyingJobs.map(job => (
        <div 
          key={job.id}
          className={`flying-job-wrapper ${job.fromLeft ? 'from-left' : 'from-right'} trajectory-${job.trajectory}`}
          style={{
            '--start-y': `${job.startY}%`,
            '--end-y': `${job.endY}%`,
            '--duration': `${job.duration}s`
          }}
          onClick={(e) => handleJobClick(e, job.id)}
          onTouchStart={(e) => handleJobClick(e, job.id)}
        >
          <img
            src="/JobLabubu.png"
            alt="Job"
            className="flying-job-img"
          />
        </div>
      ))}

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

      {/* Cheat Code Console - Only show when logged in */}
      {user && (
        <>
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
        </>
      )}

      {/* Rabbit Clock - Late Check-in (after 12:00) */}
      {showRabbitClock && (
        <div className="rabbitclock-overlay">
          <img src="/rabbitclock.png" alt="You're late!" className="rabbitclock-img" />
        </div>
      )}

      {/* Brainrot Easter Egg */}
      {(showBrainrotLeft || showBrainrotRight) && (
        <div className="brainrot-overlay">
          {showBrainrotLeft && (
            <div className="brainrot-container brainrot-left">
              <button className="brainrot-close" onClick={() => setShowBrainrotLeft(false)}>✕</button>
              {!brainrotLoaded.left && <div className="brainrot-loader"><div className="spinner" /></div>}
              <video
                className={`brainrot-video ${brainrotLoaded.left ? 'loaded' : ''}`}
                autoPlay
                loop
                playsInline
                onCanPlay={() => setBrainrotLoaded(prev => ({ ...prev, left: true }))}
              >
                <source src="/brainrot/brainrot1.mp4" type="video/mp4" />
              </video>
            </div>
          )}
          {showBrainrotRight && (
            <div className="brainrot-container brainrot-right">
              <button className="brainrot-close" onClick={() => setShowBrainrotRight(false)}>✕</button>
              {!brainrotLoaded.right && <div className="brainrot-loader"><div className="spinner" /></div>}
              <video
                className={`brainrot-video ${brainrotLoaded.right ? 'loaded' : ''}`}
                autoPlay
                loop
                playsInline
                onCanPlay={() => setBrainrotLoaded(prev => ({ ...prev, right: true }))}
              >
                <source src="/brainrot/brainrot2.mp4" type="video/mp4" />
              </video>
            </div>
          )}
        </div>
      )}

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

      {/* FNAF Jumpscare Easter Egg */}
      {showFnaf && (
        <div className="fnaf-overlay" onClick={() => { fnafReversingRef.current = false; setShowFnaf(false); }}>
          <video
            ref={fnafVideoRef}
            className="fnaf-video"
            autoPlay
            playsInline
            onEnded={() => {
              // Start reversing
              fnafReversingRef.current = true;
              const video = fnafVideoRef.current;
              if (!video) return;
              
              let lastTime = performance.now();
              const reverse = (now) => {
                if (!fnafReversingRef.current || !fnafVideoRef.current) return;
                const delta = (now - lastTime) / 1000; // seconds elapsed
                lastTime = now;
                video.currentTime = Math.max(0, video.currentTime - delta); // real-time reverse
                if (video.currentTime <= 0) {
                  // Reached start, close
                  fnafReversingRef.current = false;
                  setShowFnaf(false);
                } else {
                  requestAnimationFrame(reverse);
                }
              };
              requestAnimationFrame(reverse);
            }}
          >
            <source src="/FOX.webm" type="video/webm" />
          </video>
        </div>
      )}

      {/* Ranking Game Modal */}
      {showRanking && (
        <div className="chess-overlay" onClick={() => setShowRanking(false)}>
          <div className="ranking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ranking-header">
              <h2>🏆 Ranking</h2>
              <button className="chess-close" onClick={() => setShowRanking(false)}>✕</button>
            </div>
            <p className="ranking-question">Wie was wie, volgens Simo en Tibi?</p>
            
            <div className="ranking-image-container">
              <img src="/ranking.jpeg" alt="Ranking" className="ranking-image" />
              <div className="ranking-dropzones">
                {[1, 2, 3, 4, 5, 6].map(pos => (
                  <div 
                    key={pos}
                    className={`ranking-dropzone pos-${pos} ${rankingAnswers[pos] ? 'filled' : ''} ${rankingChecked ? (isAnswerCorrect(pos) ? 'correct' : 'wrong') : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const name = e.dataTransfer.getData('text/plain');
                      handleRankingDrop(pos, name);
                      setRankingChecked(false); // Reset check when dropping new name
                    }}
                    onClick={() => {
                      if (rankingAnswers[pos]) {
                        handleRankingDrop(pos, null);
                        setRankingChecked(false);
                      }
                    }}
                  >
                    {rankingAnswers[pos] || ''}
                  </div>
                ))}
              </div>
            </div>

            <div className="ranking-game-names">
              {getAvailableNames().map(name => (
                <div
                  key={name}
                  className="ranking-game-name"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', name)}
                >
                  {name}
                </div>
              ))}
            </div>

            {!rankingComplete ? (
              <button className="ranking-check-btn" onClick={checkRankingAnswers}>
                Check Antwoorden
              </button>
            ) : (
              <div className="ranking-success">🎉 Correct! Goed gedaan!</div>
            )}
          </div>
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
