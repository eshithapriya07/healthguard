import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

const EMPTY = {
  fullName: '',
  age: '',
  gender: 'unspecified',
  heightCm: '',
  weightKg: '',
  bloodGroup: '',
  knownConditions: '',
  allergies: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

/** Profile management + language preference + change password. */
export default function Profile() {
  const { t } = useTranslation();
  const { user, changeLanguage } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/profile')
      .then(({ profile }) =>
        setForm({
          fullName: profile.full_name || '',
          age: profile.age ?? '',
          gender: profile.gender || 'unspecified',
          heightCm: profile.height_cm ?? '',
          weightKg: profile.weight_kg ?? '',
          bloodGroup: profile.blood_group || '',
          knownConditions: profile.known_conditions || '',
          allergies: profile.allergies || '',
          emergencyContactName: profile.emergency_contact_name || '',
          emergencyContactPhone: profile.emergency_contact_phone || '',
        })
      )
      .catch(() => setError(t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (form.fullName.trim().length < 2) return setError(t('profile.validation.name'));
    setBusy(true);
    try {
      await api.put('/profile', { ...form, age: form.age === '' ? null : Number(form.age), heightCm: form.heightCm === '' ? null : Number(form.heightCm), weightKg: form.weightKg === '' ? null : Number(form.weightKg) });
      setNotice(t('profile.saved'));
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const changePwd = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (pwd.newPassword !== pwd.confirm) return setError(t('auth.weakPassword'));
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
      setNotice(t('auth.passwordChanged'));
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label={t('common.loading')} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{t('profile.title')}</h1>

      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}

      <form onSubmit={save} className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="fullName">{t('auth.fullName')}</label>
          <input id="fullName" className="input" required value={form.fullName} onChange={set('fullName')} />
        </div>
        <div>
          <label className="label" htmlFor="age">{t('profile.age')}</label>
          <input id="age" type="number" min="1" max="120" className="input" value={form.age} onChange={set('age')} />
        </div>
        <div>
          <label className="label" htmlFor="gender">{t('profile.gender')}</label>
          <select id="gender" className="input" value={form.gender} onChange={set('gender')}>
            {['female', 'male', 'other', 'unspecified'].map((g) => (
              <option key={g} value={g}>{t(`genders.${g}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="heightCm">{t('profile.height')}</label>
          <input id="heightCm" type="number" step="0.1" className="input" value={form.heightCm} onChange={set('heightCm')} />
        </div>
        <div>
          <label className="label" htmlFor="weightKg">{t('profile.weight')}</label>
          <input id="weightKg" type="number" step="0.1" className="input" value={form.weightKg} onChange={set('weightKg')} />
        </div>
        <div>
          <label className="label" htmlFor="bloodGroup">{t('profile.bloodGroup')}</label>
          <input id="bloodGroup" className="input" placeholder="O+" value={form.bloodGroup} onChange={set('bloodGroup')} />
        </div>
        <div>
          <label className="label" htmlFor="knownConditions">{t('profile.knownConditions')}</label>
          <input id="knownConditions" className="input" value={form.knownConditions} onChange={set('knownConditions')} />
        </div>
        <div>
          <label className="label" htmlFor="allergies">{t('profile.allergies')}</label>
          <input id="allergies" className="input" value={form.allergies} onChange={set('allergies')} />
        </div>
        <div>
          <label className="label" htmlFor="emergencyContactName">{t('profile.emergencyName')}</label>
          <input id="emergencyContactName" className="input" value={form.emergencyContactName} onChange={set('emergencyContactName')} />
        </div>
        <div>
          <label className="label" htmlFor="emergencyContactPhone">{t('profile.emergencyPhone')}</label>
          <input id="emergencyContactPhone" className="input" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} />
        </div>
        <div>
          <label className="label" htmlFor="language">{t('profile.language')}</label>
          <select
            id="language"
            className="input"
            value={user?.language === 'hi' ? 'hi' : 'en'}
            onChange={(e) => changeLanguage(e.target.value, true)}
          >
            <option value="en">{t('language.english')}</option>
            <option value="hi">{t('language.hindi')}</option>
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <button type="submit" className="btn-primary" disabled={busy}>{t('profile.saveProfile')}</button>
        </div>
      </form>

      <form onSubmit={changePwd} className="card max-w-xl space-y-4">
        <h2 className="text-lg font-semibold text-slate-700">{t('profile.security')}</h2>
        <div>
          <label className="label" htmlFor="currentPassword">{t('auth.currentPassword')}</label>
          <input id="currentPassword" type="password" className="input" required value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="newPassword">{t('auth.newPassword')}</label>
          <input id="newPassword" type="password" className="input" required value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="confirmPassword">{t('auth.confirmPassword')}</label>
          <input id="confirmPassword" type="password" className="input" required value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
        </div>
        <button type="submit" className="btn-secondary" disabled={busy}>{t('auth.changePassword')}</button>
      </form>
    </div>
  );
}
