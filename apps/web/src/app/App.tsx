import { useState } from 'react';
import { Dashboard } from '../features/dashboard';
import { LoginPage } from '../pages/LoginPage';

export function App() {
  const [signedIn, setSignedIn] = useState(false);
  return signedIn ? <Dashboard onLogout={() => setSignedIn(false)} /> : <LoginPage onLogin={() => setSignedIn(true)} />;
}
