import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button, Card, Disclaimer, Screen, Segmented, flag } from '../../components/ui';
import { APP_NAME, CONTACT_EMAIL } from '../../config/app';
import { activeCountry } from '../../domain/profile';
import { LANGUAGES, type Language } from '../../domain/types';
import { useAppStore } from '../../store/appStore';
import { downloadExport } from '../../store/backup';

const linkClass = 'flex min-h-11 items-center justify-between border-t border-bd py-2 first:border-t-0';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setLanguage, deleteAll, trip } = useAppStore();
  const [exported, setExported] = useState(false);
  const country = trip ? activeCountry(trip) : null;

  return (
    <Screen title={t('settings.title')}>
      <Card>
        <Segmented
          name="language"
          legend={t('settings.language')}
          value={i18n.language as Language}
          options={LANGUAGES.map((l) => ({ value: l, label: t(`languages.${l}`) }))}
          onChange={(l) => {
            void i18n.changeLanguage(l);
            void setLanguage(l);
          }}
        />
        {country && (
          <p className="mb-2 text-sm">
            {t('settings.currentCountry', { country: `${flag(country)} ${t(`countries.${country}`)}` })}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate('/onboarding')}>{t('settings.changeCountry')}</Button>
          <Button onClick={() => navigate('/onboarding/profile')}>{t('settings.editProfile')}</Button>
          <Button onClick={() => navigate('/targets')}>{t('settings.editTargets')}</Button>
        </div>
        <p className="mt-3 text-sm">
          <span className="font-medium">{t('settings.units')}:</span>{' '}
          <span className="text-mu">{t('settings.unitsValue')}</span>
        </p>
      </Card>

      <Disclaimer />

      <Card>
        <h2 className="mb-1 font-semibold">{t('settings.data')}</h2>
        <p className="mb-3 text-sm text-mu">{t('settings.dataHint')}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              await downloadExport();
              setExported(true);
            }}
          >
            {t('settings.export')}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!window.confirm(t('settings.deleteConfirm'))) return;
              await deleteAll();
              navigate('/onboarding', { replace: true });
            }}
          >
            {t('settings.deleteAll')}
          </Button>
        </div>
        {exported && (
          <p className="mt-2 text-sm text-mu" role="status">
            {t('settings.exported')}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">{t('settings.about')}</h2>
        <nav aria-label={t('settings.about')}>
          <Link to="/privacy" className={linkClass}>
            {t('settings.privacy')} <span aria-hidden>›</span>
          </Link>
          <Link to="/credits" className={linkClass}>
            {t('settings.credits')} <span aria-hidden>›</span>
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`${APP_NAME} ${__APP_VERSION__}`)}`}
            className={linkClass}
          >
            {t('settings.feedback')} <span aria-hidden>›</span>
          </a>
        </nav>
        <p className="mt-2 text-xs text-mu">{t('settings.version', { v: __APP_VERSION__ })}</p>
      </Card>
    </Screen>
  );
}
