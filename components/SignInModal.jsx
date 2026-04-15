import React, { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import Image from 'next/image';
import GoogleIcon from '../assets/google.png';
import Imageslider from '../assets/signin/76.webp';
import axios from 'axios';
import { countryCodes } from '../assets/countryCodes';

const SignInModal = ({ open, onClose, defaultMode = 'login', bonusMessage = '' }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [scrollPos, setScrollPos] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const getAuthErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
    const code = err?.code || '';
    const msg = String(err?.message || '').toLowerCase();

    if (code === 'auth/email-already-in-use') return 'This email is already registered. Please sign in.';
    if (code === 'auth/weak-password') return 'Password is too weak. Please use at least 6 characters.';
    if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
    if (code === 'auth/user-not-found') return 'No account found with this email. Please sign up first.';
    if (code === 'auth/wrong-password') return 'Incorrect password. Please try again.';
    if (code === 'auth/invalid-credential') return 'Invalid email or password. Please try again.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Please try again later.';
    if (code === 'auth/network-request-failed') return 'Network error. Please check your connection and try again.';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Sign-in cancelled. Please try again.';
    if (code === 'auth/popup-blocked') return 'Pop-up blocked. Please allow pop-ups and try again.';

    if (msg.includes('invalid-credential') || msg.includes('auth/invalid-credential')) {
      return 'Invalid email or password. Please try again.';
    }

    return fallback;
  };

  React.useEffect(() => {
    const interval = setInterval(() => {
      setScrollPos(prev => (prev + 1) % 2000);
    }, 10);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (open) {
      setIsRegister(defaultMode === 'register');
    }
  }, [open, defaultMode]);

  // Clear errors when switching between login and register
  React.useEffect(() => {
    setError('');
    setFieldErrors({
      name: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
  }, [isRegister]);

  if (!open) return null;

  const validateEmail = (email) => {
    // Simple email regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateName = (name) => {
    // Name should be at least 2 characters and contain only letters and spaces
    return name.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(name.trim());
  };

  const validatePhoneNumber = (phone, countryCode) => {
    const cleaned = phone.replace(/\D/g, '');
    // For India (+91), require exactly 10 digits
    if (countryCode === '+91') {
      return cleaned.length === 10;
    }
    // For other countries, allow 7-15 digits
    return cleaned.length >= 7 && cleaned.length <= 15;
  };

  const validatePassword = (password) => {
    // Password should be at least 6 characters
    return password.length >= 6;
  };

  const validatePasswordStrength = (password) => {
    // Check for strong password: at least 8 chars, contains letters and numbers
    if (password.length < 8) return 'Password should be at least 8 characters';
    if (!/[a-zA-Z]/.test(password)) return 'Password should contain letters';
    if (!/[0-9]/.test(password)) return 'Password should contain numbers';
    return null;
  };

  const trackLoginLocation = async (token) => {
    try {
      const pageUrl = typeof window !== 'undefined' ? window.location.pathname : '/';
      await axios.post('/api/users/track-location', {
        pageUrl
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      // Non-blocking
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
      
      // Check if welcome bonus was claimed from top bar
      const bonusClaimed = localStorage.getItem('welcomeBonusClaimed');
      if (bonusClaimed === 'true') {
        // Mark user as eligible for free shipping on first order
        localStorage.setItem('freeShippingEligible', 'true');
        localStorage.removeItem('welcomeBonusClaimed');
      }
      
      // Send appropriate email based on whether user is new or returning
      try {
        const token = await result.user.getIdToken();
        await trackLoginLocation(token);
        if (isNewUser) {
          await axios.post('/api/wallet/bonus', {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        const emailEndpoint = isNewUser ? '/api/send-welcome-email' : '/api/send-login-email';
        axios.post(emailEndpoint, {
          email: result.user.email,
          name: result.user.displayName
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }).catch(() => {
          // Silently fail
        });
      } catch (emailError) {
        // Failed to send email (non-critical)
      }
      
      onClose();
    } catch (err) {
      console.error('Google sign-in error:', err);
      const errorMessage = getAuthErrorMessage(err, 'Google sign-in failed. Please try again.');
      setError(errorMessage);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (isRegister) {
      // Validate name
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (!validateName(name)) {
        setError('Name should contain only letters and be at least 2 characters.');
        return;
      }
      
      // Validate phone number
      if (!phoneNumber.trim()) {
        setError('Please enter your phone number.');
        return;
      }
      if (!validatePhoneNumber(phoneNumber, countryCode)) {
        if (countryCode === '+91') {
          setError('Indian phone number must be exactly 10 digits.');
        } else {
          setError('Please enter a valid phone number (7-15 digits).');
        }
        return;
      }
      
      // Validate email
      if (!validateEmail(email)) {
        setError('Please enter a valid email address.');
        return;
      }
      
      // Validate password
      if (!validatePassword(password)) {
        setError('Password should be at least 6 characters.');
        return;
      }
      
      // Check password strength (warning, not blocking)
      const strengthError = validatePasswordStrength(password);
      if (strengthError) {
        setError(strengthError + '. We recommend a stronger password.');
        // Don't return here - it's just a warning
      }
      
      // Validate password match
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    } else {
      // Login validation
      if (!email.trim()) {
        setError('Please enter your email.');
        return;
      }
      if (!validateEmail(email)) {
        setError('Please enter a valid email address.');
        return;
      }
      if (!password.trim()) {
        setError('Please enter your password.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }
    
    setLoading(true);
    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(userCredential.user, { displayName: name });
        }

        try {
          const token = await userCredential.user.getIdToken();
          await trackLoginLocation(token);
          await axios.post('/api/wallet/bonus', {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (err) {
          // Wallet bonus failed
        }
        
        // Check if welcome bonus was claimed from top bar
        const bonusClaimed = localStorage.getItem('welcomeBonusClaimed');
        if (bonusClaimed === 'true') {
          // Mark user as eligible for free shipping on first order
          localStorage.setItem('freeShippingEligible', 'true');
          localStorage.removeItem('welcomeBonusClaimed');
        }
        
        // Send welcome email for new registrations
        try {
          const token = await userCredential.user.getIdToken();
          await axios.post('/api/send-welcome-email', {
            email: email,
            name: name
          }, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail the signup if email fails
        }
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Send login notification email in background
        try {
          const token = await userCredential.user.getIdToken();
          await trackLoginLocation(token);
          axios.post('/api/send-login-email', {
            email: email,
            name: userCredential.user.displayName || name || 'Customer'
          }, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }).catch(() => {
            // Silently fail - don't block login
          });
        } catch (emailError) {
          // Failed to send login email (non-critical)
        }
      }
      onClose();
    } catch (err) {
      const errorMessage = getAuthErrorMessage(err, 'Sign in failed. Please try again.');
      setError(errorMessage);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div 
        className="bg-white w-full sm:max-w-lg max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative"
      >
        <button
          type="button"
          className="absolute top-3 right-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-md ring-1 ring-black/10 transition hover:bg-white hover:text-black"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Top Section - Image */}
        <div className="w-full bg-gradient-to-br from-amber-200 via-amber-100 to-yellow-100 relative overflow-hidden h-32 sm:h-40 flex-shrink-0">
          {/* Image Container - Continuous Scrolling */}
          <div 
            className="absolute inset-0 flex"
            style={{
              transform: `translateX(-${scrollPos}px)`,
              transition: 'none',
              willChange: 'transform'
            }}
          >
            {/* Render image twice for seamless loop */}
            <div style={{ width: '2000px', height: '100%', flexShrink: 0, position: 'relative' }}>
              <Image
                src={Imageslider}
                alt="Sign In 1"
                width={2000}
                height={320}
                style={{ objectFit: 'cover', width: '100%', height: '100%', display: 'block' }}
                priority
                unoptimized
              />
            </div>
            <div style={{ width: '2000px', height: '100%', flexShrink: 0, position: 'relative' }}>
              <Image
                src={Imageslider}
                alt="Sign In 2"
                width={2000}
                height={320}
                style={{ objectFit: 'cover', width: '100%', height: '100%', display: 'block' }}
                priority
                unoptimized
              />
            </div>
          </div>
          
          {/* Decorative circles */}
          {/* <div className="absolute top-4 left-4 w-8 h-8 bg-green-400 rounded-full opacity-40 z-10" /> */}
          {/* <div className="absolute bottom-4 right-4 w-12 h-12 bg-pink-300 rounded-full opacity-40 z-10" /> */}
        </div>

        {/* Bottom Section - Form */}
        <div className="w-full p-4 sm:p-6 relative overflow-y-auto custom-scrollbar flex-1">
          <style jsx>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: transparent;
              border-radius: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(0, 0, 0, 0.1);
            }
            .custom-scrollbar {
              scrollbar-width: none;
              -ms-overflow-style: none;
            }
          `}</style>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">Hala! Let's get started</h2>
          <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4">Create account or sign in to your account</p>

          {bonusMessage && isRegister && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {bonusMessage}
            </div>
          )}

          {/* Tab Buttons */}
          <div className="flex gap-2 sm:gap-3 mb-3 sm:mb-4">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg font-semibold transition text-sm ${
                !isRegister
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Log in
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg font-semibold transition text-sm ${
                isRegister
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sign up
            </button>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-2.5 sm:gap-3" onSubmit={handleSubmit}>
            {isRegister && (
              <div>
                <input
                  type="text"
                  placeholder="Full Name"
                  className={`border rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-xs sm:text-sm w-full ${
                    fieldErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  value={name}
                  onChange={e => {
                    const value = e.target.value;
                    setName(value);
                    
                    // Real-time validation
                    if (!value.trim()) {
                      setFieldErrors(prev => ({ ...prev, name: 'Name is required' }));
                    } else if (!/^[a-zA-Z\s]+$/.test(value.trim())) {
                      setFieldErrors(prev => ({ ...prev, name: 'Name should contain only letters' }));
                    } else if (value.trim().length < 2) {
                      setFieldErrors(prev => ({ ...prev, name: 'Name should be at least 2 characters' }));
                    } else {
                      setFieldErrors(prev => ({ ...prev, name: '' }));
                    }
                  }}
                  onBlur={() => {
                    if (!name.trim()) {
                      setFieldErrors(prev => ({ ...prev, name: 'Name is required' }));
                    }
                  }}
                  required
                />
                {fieldErrors.name && (
                  <div className="text-red-600 text-xs mt-1">{fieldErrors.name}</div>
                )}
              </div>
            )}
            {isRegister && (
              <div>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => {
                      setCountryCode(e.target.value);
                      // Clear phone number when country code changes
                      setPhoneNumber('');
                      setFieldErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    className="border border-gray-300 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-xs sm:text-sm w-24"
                    required
                  >
                    {countryCodes.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    className={`flex-1 border rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-xs sm:text-sm ${
                      fieldErrors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    value={phoneNumber}
                    onChange={e => {
                      // Limit based on country code
                      const maxLength = countryCode === '+91' ? 10 : 15;
                      const value = e.target.value.replace(/\D/g, '').slice(0, maxLength);
                      setPhoneNumber(value);
                      
                      // Real-time validation
                      if (!value) {
                        setFieldErrors(prev => ({ ...prev, phone: 'Phone number is required' }));
                      } else if (countryCode === '+91' && value.length !== 10) {
                        setFieldErrors(prev => ({ ...prev, phone: 'Indian phone number must be 10 digits' }));
                      } else if (countryCode !== '+91' && value.length < 7) {
                        setFieldErrors(prev => ({ ...prev, phone: 'Phone number must be at least 7 digits' }));
                      } else if (countryCode !== '+91' && value.length > 15) {
                        setFieldErrors(prev => ({ ...prev, phone: 'Phone number too long' }));
                      } else {
                        setFieldErrors(prev => ({ ...prev, phone: '' }));
                      }
                    }}
                    onBlur={() => {
                      if (!phoneNumber) {
                        setFieldErrors(prev => ({ ...prev, phone: 'Phone number is required' }));
                      } else if (countryCode === '+91' && phoneNumber.length !== 10) {
                        setFieldErrors(prev => ({ ...prev, phone: 'Indian phone number must be 10 digits' }));
                      }
                    }}
                    maxLength={countryCode === '+91' ? 10 : 15}
                    required
                  />
                </div>
                {fieldErrors.phone ? (
                  <div className="text-red-600 text-xs mt-1">{fieldErrors.phone}</div>
                ) : (
                  <div className="text-gray-500 text-xs mt-1">
                    {countryCode === '+91' ? '10 digits required' : '7-15 digits required'}
                  </div>
                )}
              </div>
            )}
            <div>
              <input
                type="email"
                placeholder="Email"
                className={`border rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-xs sm:text-sm w-full ${
                  fieldErrors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  
                  // Real-time validation for email in both login and register
                  const emailValue = e.target.value;
                  if (!emailValue) {
                    setFieldErrors(prev => ({ ...prev, email: 'Email is required' }));
                  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
                    setFieldErrors(prev => ({ ...prev, email: 'Please enter a valid email' }));
                  } else {
                    setFieldErrors(prev => ({ ...prev, email: '' }));
                  }
                }}
                onBlur={() => {
                  if (!email) {
                    setFieldErrors(prev => ({ ...prev, email: 'Email is required' }));
                  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    setFieldErrors(prev => ({ ...prev, email: 'Please enter a valid email' }));
                  }
                }}
                required
              />
              {fieldErrors.email && (
                <div className="text-red-600 text-xs mt-1">{fieldErrors.email}</div>
              )}
            </div>
            <div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className={`border rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-xs sm:text-sm w-full ${
                    fieldErrors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    
                    // Real-time validation for both login and register
                    const pwdValue = e.target.value;
                    if (!pwdValue) {
                      setFieldErrors(prev => ({ ...prev, password: 'Password is required' }));
                    } else if (pwdValue.length < 6) {
                      setFieldErrors(prev => ({ ...prev, password: 'Password must be at least 6 characters' }));
                    } else if (isRegister && pwdValue.length < 8) {
                      setFieldErrors(prev => ({ ...prev, password: 'Weak password. Use 8+ characters' }));
                    } else if (isRegister && (!/[0-9]/.test(pwdValue) || !/[a-zA-Z]/.test(pwdValue))) {
                      setFieldErrors(prev => ({ ...prev, password: 'Use both letters and numbers for stronger password' }));
                    } else {
                      setFieldErrors(prev => ({ ...prev, password: '' }));
                    }
                  }}
                  onBlur={() => {
                    const pwdValue = password;
                    if (!pwdValue) {
                      setFieldErrors(prev => ({ ...prev, password: 'Password is required' }));
                    } else if (pwdValue.length < 6) {
                      setFieldErrors(prev => ({ ...prev, password: 'Password must be at least 6 characters' }));
                    }
                  }}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.password && (
                <div className="text-red-600 text-xs mt-1">{fieldErrors.password}</div>
              )}
            </div>
            {isRegister && (
              <div>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Password"
                    className={`border rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-xs sm:text-sm w-full ${
                      fieldErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    value={confirmPassword}
                    onChange={e => {
                      setConfirmPassword(e.target.value);
                      
                      // Real-time validation
                      const confirmValue = e.target.value;
                      if (!confirmValue) {
                        setFieldErrors(prev => ({ ...prev, confirmPassword: 'Please confirm your password' }));
                      } else if (confirmValue !== password) {
                        setFieldErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
                      } else {
                        setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
                      }
                    }}
                    onBlur={() => {
                      if (!confirmPassword) {
                        setFieldErrors(prev => ({ ...prev, confirmPassword: 'Please confirm your password' }));
                      } else if (confirmPassword !== password) {
                        setFieldErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
                      }
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <div className="text-red-600 text-xs mt-1">{fieldErrors.confirmPassword}</div>
                )}
              </div>
            )}
            
            {error && (
              <div className="text-red-500 text-xs sm:text-sm bg-red-50 p-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="bg-gray-800 hover:bg-gray-900 text-white font-semibold py-2 sm:py-2.5 rounded-lg transition text-xs sm:text-sm disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'CONTINUE'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-2 sm:gap-3 my-3 sm:my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-gray-400 text-xs">OR</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2 sm:gap-3 border border-gray-300 rounded-lg py-2 sm:py-2.5 px-3 sm:px-4 text-xs sm:text-sm font-medium bg-white hover:bg-gray-50 transition mb-3 sm:mb-5"
            disabled={loading}
          >
            <Image src={GoogleIcon} alt="Google" width={16} height={16} style={{objectFit:'contain'}} />
            <span className="text-gray-700">Continue with Google</span>
          </button>

          {/* Terms & Privacy */}
          <p className="text-xs text-gray-500 text-center">
            By continuing, I confirm that I have read the{' '}
            <a href="/privacy-policy" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignInModal;
