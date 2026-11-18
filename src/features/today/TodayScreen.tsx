import { useTranslation } from 'react-i18next';
import { Card, Screen } from '../../components/ui';

/** Placeholder: la pantalla Hoy completa es la Fase 2. */
export function TodayScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('today.title')}>
      <Card>
        <p className="text-mu">{t('today.comingSoon')}</p>
      </Card>
    </Screen>
  );
}
