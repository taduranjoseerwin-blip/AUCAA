import { Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { useAuth } from "./context/AuthContext"
import Sidebar from "./components/Sidebar"
import Topbar from "./components/Topbar"
import Login from "./pages/Login"
import Highlights from "./pages/Highlights"
import Standings from "./pages/Standings"
import Bracket from "./pages/Bracket"
import Players from "./pages/Players"
import Announcements from "./pages/Announcements"
import Stats from "./pages/Stats"
import Teams from "./pages/Teams"
import Admin from "./pages/Admin"
import Coach from "./pages/Coach"
import Reports from "./pages/Reports"
import VerifyEmail from "./pages/VerifyEmail"
import Settings from "./pages/Settings"
import Footer from "./components/Footer"

function Layout() {
  const { user, loading } = useAuth()

  if (loading) return <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: 'var(--bg-deep)', color: 'var(--text-muted)', fontSize: 14
  }}>Loading...</div>

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {user && <Sidebar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/highlights" element={<Highlights />} />
            <Route path="/standings"  element={<Standings />} />
            <Route path="/bracket"    element={<Bracket />} />
            <Route path="/players"    element={<Players />} />
            <Route path="/announcements" element={
              user ? <Announcements /> : <Navigate to="/highlights" replace />
            } />
            <Route path="/stats"      element={<Stats />} />
            <Route path="/teams"      element={<Teams />} />
            <Route path="/admin"      element={
              ['admin'].includes(user?.role) ? <Admin /> : <Navigate to="/highlights" replace />
            } />
            <Route path="/league"     element={
              ['league_manager'].includes(user?.role) ? <Admin /> : <Navigate to="/highlights" replace />
            } />
            <Route path="/coach"      element={
              ['coach'].includes(user?.role) ? <Coach /> : <Navigate to="/highlights" replace />
            } />
            <Route path="/reports"    element={
              ['admin', 'league_manager'].includes(user?.role) ? <Reports /> : <Navigate to="/highlights" replace />
            } />
            <Route path="/settings"   element={
              user ? <Settings /> : <Navigate to="/highlights" replace />
            } />
            <Route path="/profile"    element={
              user?.role === 'player' ? <Settings profileOnly /> : <Navigate to="/highlights" replace />
            } />
            <Route path="*"           element={<Navigate to="/highlights" />} />
              </Routes>
            </div>
            <Footer />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/verify-email" element={
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }}><VerifyEmail /></div>
            <Footer />
          </div>
        } />
        <Route path="/*"     element={<Layout />} />
      </Routes>
    </AuthProvider>
  )
}