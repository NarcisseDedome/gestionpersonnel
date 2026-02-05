import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bshgnpspzugblqbgccaw.supabase.co',
  'sb_publishable_wZaAbH2_qPA9DL13fbUGEw_lCjIWQXm'
);

import {
  LayoutDashboard, Users, LogOut, Search, Settings, FileText, CheckCircle, Clock, BookOpen, User, Mail, Lock, Info, AlertTriangle, Edit, Archive, Download, Upload, PieChart as PieChartIcon, BarChart as BarChartIcon, History, ArrowRight
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

const LOGO_PERSONNEL = '/logo.jpg';
const API_URL = import.meta.env.MODE === 'production' ? '' : 'http://localhost:3001';

const calculateDaysLeft = (date) => {
  if (!date) return 'N/A';
  const diff = new Date(date) - new Date();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Déjà retraité';
  return `${days} jours restants`;
};

const TeacherRow = memo(({ t, handleEdit, handleArchive }) => (
  <tr style={{ opacity: t.is_archived ? 0.5 : 1 }}>
    <td>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ padding: '0.5rem', background: '#F3F4F6', borderRadius: '8px', color: '#6B7280' }}>
          <User size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', textDecoration: t.is_archived ? 'line-through' : 'none' }}>{t.nom}</div>
          <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{t.prenoms} • {t.matricule}</div>
        </div>
      </div>
    </td>
    <td>
      <div style={{ fontWeight: 500 }}>{t.etablissement}</div>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t.commune || '-'}</div>
    </td>
    <td>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#4B5563' }}>
        <BookOpen size={14} />
        {t.discipline || 'N/A'}
      </div>
    </td>
    <td>
      <span className={`badge badge-${(t.grade || 'C').charAt(0).toLowerCase()}`}>
        Cat. {(t.grade || 'C').charAt(0)}
      </span>
    </td>
    <td>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 500 }}>{t.date_retraite ? new Date(t.date_retraite).toLocaleDateString() : 'N/A'}</span>
        <span className={t.date_retraite && new Date(t.date_retraite) < new Date() ? 'days-alert' : 'days-ok'} style={{ fontSize: '0.75rem' }}>
          {calculateDaysLeft(t.date_retraite)}
        </span>
      </div>
    </td>
    <td style={{ textAlign: 'right' }}>
      <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" style={{ padding: '0.25rem' }} title="Modifier" onClick={() => handleEdit(t)}>
          <Edit size={14} />
        </button>
        <button className="btn" style={{ padding: '0.25rem', backgroundColor: t.is_archived ? '#F3F4F6' : '#FEF2F2', color: t.is_archived ? '#6B7280' : '#EF4444' }} title={t.is_archived ? "Désarchiver" : "Archiver"} onClick={() => handleArchive(t)}>
          <Archive size={14} />
        </button>
        <div style={{ width: '1px', background: '#e2e8f0', margin: '0 2px' }}></div>
        <button className="btn btn-success" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} title="Attestation de Validité" onClick={() => window.open(`${API_URL}/api/teachers/${t.id}/certificate-validity`)}>
          <CheckCircle size={14} />
          Validité
        </button>
        <button className="btn btn-warning" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} title="Présence au Poste" onClick={() => window.open(`${API_URL}/api/teachers/${t.id}/presence-post`)}>
          <Clock size={14} />
          Présence
        </button>
      </div>
    </td>
  </tr>
));

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [activeNav, setActiveNav] = useState('teachers');

  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [newTeacher, setNewTeacher] = useState({
    nom: '', prenoms: '', matricule: '', sexe: 'M',
    date_naissance: '', lieu_naissance: '', statut: '', corps: '',
    grade: 'A1-1', etablissement: '', commune: '', fonction: '',
    discipline: '', date_prise_service: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchTeachers();
      fetchStats();
    }
  }, [search, category, session]);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const resp = await fetch(`${API_URL}/api/stats`);
      if (!resp.ok) throw new Error(`Erreur serveur: ${resp.status}`);
      const data = await resp.json();
      console.log('Stats reçues:', data);
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      // On peut stocker l'erreur dans le state si on veut l'afficher
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/api/teachers?search=${search}&category=${category}`);
      const data = await resp.json();
      setTeachers(data);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleLogout = () => supabase.auth.signOut();

  const handleSave = async (e) => {
    e.preventDefault();

    // Validation manuelle pour éviter les blocages silencieux du navigateur
    if (!newTeacher.nom || !newTeacher.prenoms || !newTeacher.matricule || !newTeacher.date_naissance) {
      alert('Erreur : Nom, Prénoms, Matricule et Date de Naissance sont obligatoires.');
      return;
    }

    console.log('Tentative de sauvegarde:', newTeacher);
    try {
      if (!session || !session.user) {
        alert('Erreur : Session expirée. Veuillez vous reconnecter.');
        return;
      }

      const url = isEditing
        ? `${API_URL}/api/teachers/${editId}`
        : `${API_URL}/api/teachers`;
      const method = isEditing ? 'PUT' : 'POST';

      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': session.user.email
        },
        body: JSON.stringify(newTeacher)
      });

      const result = await resp.json();
      if (resp.ok) {
        alert(isEditing ? 'Enseignant mis à jour !' : 'Enseignant ajouté !');
        setShowModal(false);
        setIsEditing(false);
        setEditId(null);
        setNewTeacher({
          nom: '', prenoms: '', matricule: '', sexe: 'M',
          date_naissance: '', lieu_naissance: '', statut: '', corps: '',
          grade: 'A1-1', etablissement: '', commune: '', fonction: '',
          discipline: '', date_prise_service: ''
        });
        fetchTeachers();
        fetchStats();
      } else {
        console.error('Erreur API:', result);
        alert(`Erreur: ${result.error || 'Inconnue'}`);
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Erreur de connexion au serveur');
    }
  };

  const handleEdit = useCallback((teacher) => {
    setNewTeacher(teacher);
    setEditId(teacher.id);
    setIsEditing(true);
    setShowModal(true);
  }, []);

  const handleArchive = useCallback(async (teacher) => {
    const actionLabel = teacher.is_archived ? 'désarchiver' : 'archiver';
    if (!confirm(`Voulez-vous vraiment ${actionLabel} ${teacher.nom} ?`)) return;

    try {
      const resp = await fetch(`${API_URL}/api/teachers/${teacher.id}/archive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': session?.user?.email
        },
        body: JSON.stringify({ is_archived: !teacher.is_archived, matricule: teacher.matricule })
      });
      if (resp.ok) {
        fetchTeachers();
        fetchStats();
      }
    } catch (err) { console.error('Archive error:', err); alert('Erreur lors de l\'archivage'); }
  }, [session, fetchTeachers, fetchStats, API_URL]);

  const handleImportMassive = async (e) => {
    e.preventDefault();
    if (!importFile) return;

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const resp = await fetch(`${API_URL}/api/admin/import-massive`, {
        method: 'POST',
        headers: { 'x-admin-email': session.user.email },
        body: formData
      });
      if (resp.ok) {
        alert('Importation réussie !');
        setShowImportModal(false);
        fetchTeachers();
        fetchStats();
      } else {
        const errorData = await resp.json();
        alert(`Échec de l'importation: ${errorData.error || 'Erreur inconnue'}`);
      }
    } catch (err) {
      console.error('Import error:', err);
      alert('Erreur de connexion');
    }
  };

  const calculateDaysLeft = (dateStr) => {
    if (!dateStr) return 'N/A';
    const retirement = new Date(dateStr);
    const today = new Date();
    const diffTime = retirement - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? `${diffDays} jours` : 'Déjà à la retraite';
  };

  if (authLoading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Chargement sécurisé...</div>;

  if (!session) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <img src={LOGO_PERSONNEL} style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '1rem' }} alt="Logo" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-main)', margin: '0' }}>Gestion RH</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Espace Administratif</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'grid', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Email</label>
              <input type="email" className="input" placeholder="admin@enseignement.bj" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Mot de passe</label>
              <input type="password" className="input" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Se connecter</button>
          </form>
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <a href="#" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none' }}>Accès restreint par l'administration Collines</a>
          </div>
        </div>
      </div >
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <img src={LOGO_PERSONNEL} className="logo-img" alt="Logo" />
          </div>
          <div className="app-info">
            <h2>DDESTFP-COL</h2>
            <span className="app-subtitle">Gestion RH</span>
          </div>
        </div>

        <nav>
          <div
            className={`nav-item ${activeNav === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveNav('stats')}
          >
            <LayoutDashboard size={20} />
            <span>Tableau de Bord</span>
          </div>
          <div
            className={`nav-item ${activeNav === 'teachers' ? 'active' : ''}`}
            onClick={() => setActiveNav('teachers')}
          >
            <Users size={20} />
            <span>Enseignants</span>
          </div>
          <div
            className="nav-item"
            onClick={() => setShowAdminModal(true)}
          >
            <Settings size={20} />
            <span>Gestion Admins</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar-placeholder">
              {session.user.email.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-email">{session.user.email}</span>
              <span className="user-role">Administrateur</span>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="page-header">
          <div className="page-header-info">
            <h1>
              {activeNav === 'stats' ? 'Tableau de Bord' : 'Gestion du Personnel'}
            </h1>
            <p>
              {activeNav === 'stats' ? 'Statistiques et indicateurs de performance' : 'Base de données des enseignants des Collines'}
            </p>
          </div>
          <div className="actions">
            {activeNav === 'teachers' && (
              <>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    className="input"
                    style={{ width: '280px', paddingLeft: '2.5rem' }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>
                    <Search size={18} />
                  </span>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>Nouveau Personnel</button>
              </>
            )}
          </div>
        </header>

        {/* Content based on navigation */}
        {activeNav === 'stats' ? (
          /* Dashboard View: Charts and Emergencies */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {statsLoading && !stats ? (
              <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                <div className="loading-spinner" style={{ marginBottom: '1rem' }}></div>
                Chargement des indicateurs en cours...
              </div>
            ) : stats ? (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Total Personnel</div>
                    <span className="stat-value">{stats.total}</span>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Dossiers à Jour</div>
                    <span className="stat-value" style={{ color: '#059669' }}>
                      {stats.total - (stats.alerts?.filter(a => a.type === 'dossier_incomplet')?.length || 0)}
                    </span>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Retraites {new Date().getFullYear()}</div>
                    <span className="stat-value" style={{ color: '#DC2626' }}>{stats.upcomingRetirements}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {/* Chart 1: Répartition par Catégorie */}
                  <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <PieChartIcon size={18} color="var(--primary)" />
                      Répartition par Catégorie
                    </h3>
                    <div style={{ height: '250px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Cat. A', value: stats.categories.A || 0 },
                              { name: 'Cat. B', value: stats.categories.B || 0 },
                              { name: 'Cat. C', value: stats.categories.C || 0 },
                              { name: 'Cat. D', value: stats.categories.D || 0 },
                            ]}
                            cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                          >
                            <Cell fill="#0F172A" />
                            <Cell fill="#334155" />
                            <Cell fill="#64748B" />
                            <Cell fill="#94A3B8" />
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Répartition par Sexe */}
                  <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Users size={18} color="var(--primary)" />
                      Parité Hommes/Femmes
                    </h3>
                    <div style={{ height: '250px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Hommes', value: stats.gender.M || 0 },
                              { name: 'Femmes', value: stats.gender.F || 0 },
                            ]}
                            cx="50%" cy="50%" outerRadius={80} dataKey="value" label
                          >
                            <Cell fill="#2563EB" />
                            <Cell fill="#EC4899" />
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Section Urgences */}
                <div className="card" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#B91C1C' }}>
                    <AlertTriangle size={22} />
                    Tableau de Bord des Urgences
                  </h3>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {stats.alerts && stats.alerts.length > 0 ? stats.alerts.map((alert, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1rem',
                        background: alert.type === 'retraite_imminente' ? '#FEF2F2' : '#FFFBEB',
                        borderRadius: '8px',
                        borderLeft: `4px solid ${alert.type === 'retraite_imminente' ? '#EF4444' : '#F59E0B'}`
                      }}>
                        <div style={{ color: alert.type === 'retraite_imminente' ? '#B91C1C' : '#92400E' }}>
                          {alert.type === 'retraite_imminente' ? <Clock size={20} /> : <FileText size={20} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{alert.type === 'retraite_imminente' ? 'Retraite Imminente' : 'Dossier Incomplet'}</div>
                          <div style={{ fontSize: '0.85rem', color: '#4B5563' }}>{alert.message}</div>
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.6 }}>{alert.targetId}</div>
                      </div>
                    )) : (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>Aucune urgence détectée. Tous les dossiers sont conformes.</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '5rem', background: 'white', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                <AlertTriangle size={48} color="#EF4444" style={{ marginBottom: '1rem' }} />
                <h3 style={{ marginBottom: '0.5rem', color: '#991b1b' }}>Impossible de charger le tableau de bord</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0.5rem auto 1.5rem' }}>
                  Le serveur ne répond pas ou les données sont corrompues. Vérifiez que le backend est bien lancé.
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={fetchStats}>Nouvelle tentative</button>
                  <button className="btn btn-outline" onClick={() => window.location.reload()}>Actualiser la page</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Teachers View: Filters and Table */
          <>
            <div className="filters">
              {['All', 'A', 'B', 'C', 'D'].map(cat => (
                <button
                  key={cat}
                  className={category === cat ? 'active' : ''}
                  onClick={() => setCategory(cat)}
                >
                  {cat === 'All' ? 'Tous' : `Cat. ${cat}`}
                </button>
              ))}
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Personnel</th>
                    <th>Etablissement / Commune</th>
                    <th>Discipline</th>
                    <th>Catégorie</th>
                    <th>Retraite</th>
                    <th style={{ textAlign: 'right' }}>Documents Officiels</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>Chargement des données...</td></tr>
                  ) : teachers.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>Aucun enseignant trouvé.</td></tr>
                  ) : (
                    teachers.map(t => (
                      <TeacherRow
                        key={t.id}
                        t={t}
                        handleEdit={handleEdit}
                        handleArchive={handleArchive}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Modals placeholders - same logic as before but with new styles */}
      {showAdminModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '900px', height: '80vh' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <h2 style={{ marginRight: '1rem' }}>Centre d'Administration</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className={`btn ${activeNav === 'audit' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.8rem' }} onClick={() => {
                    setActiveNav('audit');
                    fetch('http://localhost:3001/api/admin/audit-logs').then(r => r.json()).then(setAuditLogs);
                  }}>
                    <History size={14} style={{ marginRight: '0.5rem' }} /> Journal d'Audit
                  </button>
                  <button className={`btn ${activeNav === 'import' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.8rem' }} onClick={() => setActiveNav('import')}>
                    <Upload size={14} style={{ marginRight: '0.5rem' }} /> Import de Masse
                  </button>
                  <button className={`btn ${activeNav === 'admins' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.8rem' }} onClick={() => setActiveNav('admins')}>
                    <Settings size={14} style={{ marginRight: '0.5rem' }} /> Administrateurs
                  </button>
                </div>
              </div>
              <button onClick={() => { setShowAdminModal(false); setActiveNav('teachers'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
              {activeNav === 'audit' && (
                <div className="table-wrapper">
                  <table style={{ fontSize: '0.85rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                      <tr>
                        <th>Date</th>
                        <th>Admin</th>
                        <th>Action</th>
                        <th>Cible</th>
                        <th>Détails</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map(log => (
                        <tr key={log.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                          <td>{log.admin_email}</td>
                          <td><span className={`badge badge-${log.action.toLowerCase()}`}>{log.action}</span></td>
                          <td>{log.target_id}</td>
                          <td>{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeNav === 'import' && (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ background: '#F8FAFC', border: '2px dashed #E2E8F0', padding: '3rem', borderRadius: '12px' }}>
                      <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
                        <div style={{ marginBottom: '1rem', color: 'var(--primary)' }}><Download size={48} /></div>
                        <div style={{ fontWeight: 600 }}>Cliquez pour sélectionner le fichier Excel</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.5rem' }}>Fichiers .xlsx uniquement</div>
                        <input id="file-upload" type="file" style={{ display: 'none' }} accept=".xlsx" onChange={(e) => setImportFile(e.target.files[0])} />
                      </label>
                      {importFile && (
                        <div style={{ marginTop: '1.5rem', fontWeight: 600, color: '#059669' }}>
                          Fichier prêt : {importFile.name}
                        </div>
                      )}
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ padding: '1rem 2rem' }} onClick={handleImportMassive} disabled={!importFile}>
                    Lancer l'importation massive
                  </button>
                </div>
              )}

              {activeNav === 'admins' && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const resp = await fetch(`${API_URL}/api/admin/create-user`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: adminEmail, password: adminPass })
                    });
                    if (resp.ok) {
                      alert('Administrateur créé avec succès !');
                      setAdminEmail('');
                      setAdminPass('');
                    } else {
                      alert('Échec de la création');
                    }
                  } catch (err) { alert('Erreur de connexion'); }
                }} style={{ maxWidth: '400px', margin: '0 auto' }}>
                  <div style={{ display: 'grid', gap: '1.25rem' }}>
                    <h3 style={{ textAlign: 'center' }}>Ajouter un Administrateur</h3>
                    <div className="form-group">
                      <label>Email</label>
                      <input type="email" placeholder="admin@collines.bj" className="input" required value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Mot de passe</label>
                      <input type="password" placeholder="Minimum 6 caractères" className="input" required value={adminPass} onChange={e => setAdminPass(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btn-primary">Créer le compte</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>{isEditing ? 'Modifier les Informations' : 'Nouveau Personnel Enseignant'}</h2>
              <button onClick={() => { setShowModal(false); setIsEditing(false); setEditId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Nom</label>
                    <input className="input" required placeholder="NOM" value={newTeacher.nom} onChange={e => setNewTeacher({ ...newTeacher, nom: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="form-group">
                    <label>Prénoms</label>
                    <input className="input" required placeholder="Prénoms" value={newTeacher.prenoms} onChange={e => setNewTeacher({ ...newTeacher, prenoms: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Matricule</label>
                    <input className="input" required placeholder="Ex: 567890-X" value={newTeacher.matricule} onChange={e => setNewTeacher({ ...newTeacher, matricule: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Sexe</label>
                    <select className="input" value={newTeacher.sexe} onChange={e => setNewTeacher({ ...newTeacher, sexe: e.target.value })}>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date de Naissance</label>
                    <input type="date" className="input" required value={newTeacher.date_naissance} onChange={e => setNewTeacher({ ...newTeacher, date_naissance: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Lieu de Naissance</label>
                    <input className="input" placeholder="Lieu de naissance" value={newTeacher.lieu_naissance} onChange={e => setNewTeacher({ ...newTeacher, lieu_naissance: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Statut</label>
                    <input className="input" placeholder="Ex: APE" value={newTeacher.statut} onChange={e => setNewTeacher({ ...newTeacher, statut: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Corps</label>
                    <input className="input" placeholder="Ex: Professeur Adjoint" value={newTeacher.corps} onChange={e => setNewTeacher({ ...newTeacher, corps: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Grade</label>
                    <input className="input" placeholder="Ex: A1-1" value={newTeacher.grade} onChange={e => setNewTeacher({ ...newTeacher, grade: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Établissement</label>
                    <input className="input" placeholder="Ex: CEG 1 Dassa" value={newTeacher.etablissement} onChange={e => setNewTeacher({ ...newTeacher, etablissement: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Commune</label>
                    <input className="input" placeholder="Ex: Dassa-Zoumè" value={newTeacher.commune} onChange={e => setNewTeacher({ ...newTeacher, commune: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Fonction</label>
                    <input className="input" placeholder="Ex: Enseignant" value={newTeacher.fonction} onChange={e => setNewTeacher({ ...newTeacher, fonction: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Discipline</label>
                    <input className="input" placeholder="Ex: Mathématiques" value={newTeacher.discipline} onChange={e => setNewTeacher({ ...newTeacher, discipline: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Date Prise Service</label>
                    <input type="date" className="input" value={newTeacher.date_prise_service} onChange={e => setNewTeacher({ ...newTeacher, date_prise_service: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-danger" onClick={() => { setShowModal(false); setIsEditing(false); setEditId(null); }}>Annuler</button>
                <button type="submit" className="btn btn-success" style={{ padding: '0.75rem 1.5rem', fontWeight: 600 }}>{isEditing ? 'Enregistrer les modifications' : 'Enregistrer l\'enseignant'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
// Force Vercel Redeploy: TS_TIMESTAMP
