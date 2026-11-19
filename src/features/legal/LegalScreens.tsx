import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Card, Screen } from '../../components/ui';
import { CONTACT_EMAIL } from '../../config/app';

import { PRIVACY_UPDATED } from './privacyVersion';
const SECTIONS = ['what', 'where', 'network', 'analytics', 'rights', 'age', 'medical', 'controller'] as const;

function BackLink({ label }: { label: string }) {
  const navigate = useNavigate();
  return (
    <button className="mb-3 inline-flex min-h-11 items-center text-ac underline" onClick={() => navigate(-1)}>
      ← {label}
    </button>
  );
}

export function PrivacyScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('privacy.title')}>
      <BackLink label={t('privacy.back')} />
      <p className="mb-4 text-sm text-mu">{t('privacy.updated', { date: PRIVACY_UPDATED })}</p>
      {SECTIONS.map((s) => (
        <Card key={s}>
          <h2 className="mb-1 font-semibold">{t(`privacy.sections.${s}.title`)}</h2>
          <p>{t(`privacy.sections.${s}.body`, { email: CONTACT_EMAIL })}</p>
        </Card>
      ))}
    </Screen>
  );
}

const DATA = [
  { key: 'off', site: 'https://world.openfoodfacts.org', license: 'https://opendatacommons.org/licenses/odbl/1-0/' },
  { key: 'openPrices', site: 'https://prices.openfoodfacts.org', license: 'https://opendatacommons.org/licenses/odbl/1-0/' },
  { key: 'usda', site: 'https://fdc.nal.usda.gov', license: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  { key: 'seed' },
  { key: 'met', site: 'https://pacompendium.com' },
] as const;

export function CreditsScreen() {
  const { t } = useTranslation();
  const ext = 'min-h-11 inline-flex items-center text-ac underline';
  return (
    <Screen title={t('credits.title')}>
      <BackLink label={t('credits.back')} />
      <Card>
        <h2 className="mb-2 font-semibold">{t('credits.dataTitle')}</h2>
        <ul className="space-y-3">
          {DATA.map((d) => (
            <li key={d.key} data-testid={`credit-${d.key}`}>
              <p>{t(`credits.${d.key}`)}</p>
              <p className="flex gap-4 text-sm">
                {'site' in d && (
                  <a className={ext} href={d.site} target="_blank" rel="noreferrer">
                    {t('credits.siteLink')}
                  </a>
                )}
                {'license' in d && (
                  <a className={ext} href={d.license} target="_blank" rel="noreferrer">
                    {t('credits.licenseLink')}
                  </a>
                )}
              </p>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">{t('credits.softwareTitle')}</h2>
        <p>{t('credits.software')}</p>
      </Card>
    </Screen>
  );
}
