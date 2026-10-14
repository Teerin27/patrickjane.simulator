import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './hooks/useAuth'
import GamePage from './pages/GamePage'
import LoginPage from './pages/LoginPage'
import MainMenuPage from './pages/MainMenuPage'
import MultiplayerPage from './pages/MultiplayerPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<MainMenuPage />} />
          <Route path="/play" element={<GamePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* mock pages: placeholders until the real ones are built */}
          <Route path="/multiplayer" element={<MultiplayerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
