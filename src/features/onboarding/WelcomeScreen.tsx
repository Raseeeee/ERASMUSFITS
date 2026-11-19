import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button, Card, Disclaimer, Field, Screen, Segmented, flag, inputClass } from '../../components/ui';
import { COUNTRIES, LANGUAGES, type CountryCode, type Language, type Trip } from '../../domain/types';
import { validateTrip } from '../../domain/profile';
import { useAppStore } from '../../store/appStore';
import { PRIVACY_UPDATED } from '../legal/privacyVersion';

export function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { trip: saved, setLanguage, setTrip, privacyAccepted, acceptPrivacy } = useAppStore();
  // Si la política cambia de fecha, hay que volver a aceptarla.
  const [accepted, setAccepted] = useState(privacyAccepted === PRIVACY_UPDATED);

  const [erasmus, setErasmus] = useState<boolean>(saved ? saved.erasmus : true);
  const [origin, setOrigin] = useState<CountryCode | ''>(saved?.erasmus ? saved.origin : '');
  const [destination, setDestination] = useState<CountryCode | ''>(saved?.erasmus ? saved.destination : '');
  const [nationality, setNationality] = useState<CountryCode | ''>(
    saved && !saved.erasmus ? saved.nationality : '',
  );

  const lang = (LANGUAGES as readonly string[]).includes(i18n.language) ? (i18n.language as Language) : 'en';

  let trip: Trip | null = null;
  if (erasmus && origin && destination) trip = { erasmus: true, origin, destination };
  if (!erasmus && nationality) trip = { erasmus: false, nationality };
  const sameCountry = erasmus && !!origin && origin === destination;
  const valid = !!trip && validateTrip(trip);

  const countrySelect = (label: string, value: CountryCode | '', onChange: (c: CountryCode) => void, error?: string | null) => (
    <Field label={label} error={error}>
      {(a) => (
        <select {...a} className={inputClass} value={value} onChange={(e) => onChange(e.target.value as CountryCode)}>
          <option value="" disabled>
            {t('common.choose')}
          </option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {flag(c)} {t(`countries.${c}`)}
            </option>
          ))}
        </select>
      )}
    </Field>
  );

  async function onContinue() {
    if (!trip || !valid || !accepted) return;
    await acceptPrivacy(PRIVACY_UPDATED);
    await setLanguage(lang);
    await setTrip(trip);
    navigate('/onboarding/profile');
  }

  return (
    <Screen title={t('welcome.title')}>
      <p className="mb-4 text-mu">{t('welcome.subtitle')}</p>
      <Card>
        <Segmented
          name="language"
          legend={t('welcome.language')}
          value={lang}
          options={LANGUAGES.map((l) => ({ value: l, label: t(`languages.${l}`) }))}
          onChange={(l) => {
            void i18n.changeLanguage(l);
            void setLanguage(l);
          }}
        />
        <Segmented
          name="erasmus"
          legend={t('welcome.erasmusQuestion')}
          value={erasmus ? 'yes' : 'no'}
          options={[
            { value: 'yes', label: t('common.yes') },
            { value: 'no', label: t('common.no') },
          ]}
          onChange={(v) => setErasmus(v === 'yes')}
        />
        {erasmus ? (
          <>
            {countrySelect(t('welcome.origin'), origin, setOrigin)}
            {countrySelect(t('welcome.destination'), destination, setDestination, sameCountry ? t('welcome.sameCountry') : null)}
          </>
        ) : (
          countrySelect(t('welcome.nationality'), nationality, setNationality)
        )}
      </Card>
      <Disclaimer />
      <p className="mb-2 text-sm text-mu">{t('privacyNotice')}</p>
      <div className="mb-4 flex min-h-11 items-start gap-3">
        <input
          id="accept-privacy"
          type="checkbox"
          className="mt-0.5 size-6 shrink-0 accent-ac"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <label htmlFor="accept-privacy" className="text-sm">
          {t('welcome.acceptPrivacy')}{' '}
          <Link to="/privacy" className="text-ac underline">
            {t('welcome.privacyLink')}
          </Link>
        </label>
      </div>
      <Button variant="primary" className="w-full" disabled={!valid || !accepted} onClick={onContinue}>
        {t('common.continue')}
      </Button>
    </Screen>
  );
}
